package chronos.dw.admin.application.service;

import chronos.dw.admin.application.port.in.SyncActiveEtlLaunchesUseCase;
import chronos.dw.admin.application.port.out.EtlLaunchPort;
import chronos.dw.admin.application.port.out.HopExecutionPort;
import chronos.dw.admin.configuration.EtlProperties;
import chronos.dw.admin.domain.exception.EtlLaunchConflictException;
import chronos.dw.admin.domain.exception.HopRequestRejectedException;
import chronos.dw.admin.domain.exception.HopUnavailableException;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import chronos.dw.admin.domain.model.HopRunStatus;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Keeps etl_control.etl_launch in sync with Hop Server so the portal never queries Hop directly. Safe with several
 * instances: transitions are validated by the database and a concurrent update is simply skipped.
 */
@Service
public class EtlMonitoringService implements SyncActiveEtlLaunchesUseCase {

    private static final Logger LOG = LoggerFactory.getLogger(EtlMonitoringService.class);

    private final EtlLaunchPort launches;
    private final HopExecutionPort hop;
    private final EtlProperties.Monitoring settings;
    private final Clock clock;

    public EtlMonitoringService(EtlLaunchPort launches, HopExecutionPort hop, EtlProperties properties, Clock clock) {
        this.launches = launches;
        this.hop = hop;
        this.settings = properties.monitoring();
        this.clock = clock;
    }

    @Override
    public int syncActiveLaunches() {
        List<EtlLaunch> active = launches.findActive(settings.batchSize());
        int changed = 0;
        for (EtlLaunch launch : active) {
            try {
                if (sync(launch)) {
                    changed++;
                }
            } catch (HopUnavailableException exception) {
                LOG.warn("Hop Server unavailable while monitoring launches: {}", exception.getMessage());
                break;
            } catch (EtlLaunchConflictException exception) {
                LOG.debug("Launch {} changed concurrently: {}", launch.id(), exception.getMessage());
            } catch (RuntimeException exception) {
                LOG.error("Could not synchronize launch {}", launch.id(), exception);
            }
        }
        return changed;
    }

    private boolean sync(EtlLaunch launch) {
        Instant now = clock.instant();
        if (launch.hopExecutionId() == null) {
            return expireQueued(launch, now);
        }

        HopRunStatus status = hop.status(launch.hopExecutionId());
        if (launch.stopRequested()
                && (status.state() == HopRunStatus.State.WAITING || status.state() == HopRunStatus.State.RUNNING)) {
            requestStop(launch);
        }

        String logExcerpt = EtlLogExcerpts.tail(status.log(), settings.logExcerptMaxChars());
        return switch (status.state()) {
            case WAITING -> false;
            case RUNNING -> {
                if (launch.status() == EtlLaunchStatus.SUBMITTED) {
                    launches.transition(
                            launch.id(),
                            EtlLaunchStatus.RUNNING,
                            LaunchEtlService.SYSTEM_ACTOR,
                            null,
                            null,
                            logExcerpt);
                    yield true;
                }
                launches.transition(
                        launch.id(), launch.status(), LaunchEtlService.SYSTEM_ACTOR, null, null, logExcerpt);
                yield false;
            }
            case SUCCEEDED -> finish(launch, EtlLaunchStatus.SUCCEEDED, "Workflow finalizado sin errores", logExcerpt);
            case FAILED -> finish(
                    launch,
                    EtlLaunchStatus.FAILED,
                    EtlLogExcerpts.failureSummary(
                            status.errorDescription(), status.log(), "El workflow terminó con errores en Hop Server"),
                    logExcerpt);
            case STOPPED -> finish(
                    launch,
                    EtlLaunchStatus.STOPPED,
                    launch.stopRequested()
                            ? "Detenido a pedido de " + launch.stopRequestedBy()
                            : "Detenido en Hop Server",
                    logExcerpt);
            case NOT_FOUND -> lost(launch, now);
        };
    }

    private boolean finish(EtlLaunch launch, EtlLaunchStatus target, String summary, String logExcerpt) {
        launches.transition(launch.id(), target, LaunchEtlService.SYSTEM_ACTOR, null, summary, logExcerpt);
        hop.remove(launch.hopExecutionId());
        return true;
    }

    private boolean lost(EtlLaunch launch, Instant now) {
        Instant since = launch.submittedAt() == null ? launch.requestedAt() : launch.submittedAt();
        if (since.plus(settings.notFoundGrace()).isAfter(now)) {
            return false;
        }
        launches.transition(
                launch.id(),
                EtlLaunchStatus.FAILED,
                LaunchEtlService.SYSTEM_ACTOR,
                null,
                "Hop Server ya no reporta la ejecución (posible reinicio del servidor)",
                null);
        return true;
    }

    private boolean expireQueued(EtlLaunch launch, Instant now) {
        if (launch.requestedAt().plus(settings.queuedGrace()).isAfter(now)) {
            return false;
        }
        launches.transition(
                launch.id(),
                EtlLaunchStatus.SUBMIT_FAILED,
                LaunchEtlService.SYSTEM_ACTOR,
                null,
                "La solicitud no llegó a Hop Server",
                null);
        return true;
    }

    private void requestStop(EtlLaunch launch) {
        try {
            hop.stop(launch.hopExecutionId());
        } catch (HopRequestRejectedException exception) {
            LOG.debug("Hop Server did not apply the stop of launch {}: {}", launch.id(), exception.getMessage());
        }
    }
}
