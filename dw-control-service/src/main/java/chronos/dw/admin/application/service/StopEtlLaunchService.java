package chronos.dw.admin.application.service;

import chronos.dw.admin.application.port.in.StopEtlLaunchUseCase;
import chronos.dw.admin.application.port.out.EtlLaunchPort;
import chronos.dw.admin.application.port.out.HopExecutionPort;
import chronos.dw.admin.domain.exception.EtlLaunchConflictException;
import chronos.dw.admin.domain.exception.EtlLaunchNotFoundException;
import chronos.dw.admin.domain.exception.HopRequestRejectedException;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Records the stop request (audited) and asks Hop Server to stop the execution. The launch becomes STOPPED when the
 * monitor observes it; a queued launch that never reached Hop is stopped immediately.
 */
@Service
public class StopEtlLaunchService implements StopEtlLaunchUseCase {

    private static final Logger LOG = LoggerFactory.getLogger(StopEtlLaunchService.class);

    private final EtlLaunchPort launches;
    private final HopExecutionPort hop;

    public StopEtlLaunchService(EtlLaunchPort launches, HopExecutionPort hop) {
        this.launches = launches;
        this.hop = hop;
    }

    @Override
    public EtlLaunch stop(UUID launchId, String actor) {
        EtlLaunch current = launches.findById(launchId).orElseThrow(() -> new EtlLaunchNotFoundException(launchId));
        if (current.status().isTerminal()) {
            throw new EtlLaunchConflictException("El lanzamiento ya terminó (" + current.status() + ")");
        }

        EtlLaunch requested = launches.requestStop(launchId, actor);
        if (requested.hopExecutionId() == null) {
            return launches.transition(
                    launchId, EtlLaunchStatus.STOPPED, actor, null, "Detenido antes de enviarse a Hop Server", null);
        }

        try {
            hop.stop(requested.hopExecutionId());
        } catch (HopRequestRejectedException exception) {
            // Hop no longer knows the execution; the monitor resolves the final state.
            LOG.info("Stop of launch {} not applied by Hop Server: {}", launchId, exception.getMessage());
        }
        return requested;
    }
}
