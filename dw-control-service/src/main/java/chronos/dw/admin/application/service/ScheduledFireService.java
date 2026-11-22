package chronos.dw.admin.application.service;

import chronos.dw.admin.application.port.in.FireDueEtlSchedulesUseCase;
import chronos.dw.admin.application.port.in.LaunchEtlProcessUseCase;
import chronos.dw.admin.application.port.out.EtlLaunchPort;
import chronos.dw.admin.application.port.out.EtlSchedulePort;
import chronos.dw.admin.application.port.out.FindPendingClosurePort;
import chronos.dw.admin.configuration.EtlProperties;
import chronos.dw.admin.domain.exception.AcademicClosureNotFoundException;
import chronos.dw.admin.domain.exception.EtlExecutionNotFoundException;
import chronos.dw.admin.domain.exception.EtlLaunchConflictException;
import chronos.dw.admin.domain.exception.EtlProcessNotFoundException;
import chronos.dw.admin.domain.exception.EtlScheduleConflictException;
import chronos.dw.admin.domain.exception.InvalidEtlLaunchRequestException;
import chronos.dw.admin.domain.exception.InvalidEtlScheduleException;
import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlSchedule;
import chronos.dw.admin.domain.model.LaunchEtlCommand;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Fires due schedules. Every fire ends with exactly one launch, either a real one or a SKIPPED one with its reason,
 * so each scheduled DW update keeps its date and result. Missed occurrences (service down) are not replayed: the
 * next fire is computed from now.
 */
@Service
public class ScheduledFireService implements FireDueEtlSchedulesUseCase {

    static final int CLAIM_BATCH = 10;

    private static final Logger LOG = LoggerFactory.getLogger(ScheduledFireService.class);

    private final EtlSchedulePort schedules;
    private final EtlLaunchPort launches;
    private final LaunchEtlProcessUseCase launcher;
    private final FindPendingClosurePort pendingClosures;
    private final OperatingWindowPolicy policy;
    private final int leaseSeconds;
    private final Clock clock;
    private final Supplier<UUID> idGenerator;

    @Autowired
    public ScheduledFireService(
            EtlSchedulePort schedules,
            EtlLaunchPort launches,
            LaunchEtlProcessUseCase launcher,
            FindPendingClosurePort pendingClosures,
            OperatingWindowPolicy policy,
            EtlProperties properties,
            Clock clock) {
        this(schedules, launches, launcher, pendingClosures, policy, properties, clock, UUID::randomUUID);
    }

    ScheduledFireService(
            EtlSchedulePort schedules,
            EtlLaunchPort launches,
            LaunchEtlProcessUseCase launcher,
            FindPendingClosurePort pendingClosures,
            OperatingWindowPolicy policy,
            EtlProperties properties,
            Clock clock,
            Supplier<UUID> idGenerator) {
        this.schedules = schedules;
        this.launches = launches;
        this.launcher = launcher;
        this.pendingClosures = pendingClosures;
        this.policy = policy;
        this.leaseSeconds = properties.scheduler().leaseSeconds();
        this.clock = clock;
        this.idGenerator = idGenerator;
    }

    @Override
    public int fireDueSchedules() {
        List<EtlSchedule> claimed = schedules.claimDue(CLAIM_BATCH, leaseSeconds);
        int fired = 0;
        for (EtlSchedule schedule : claimed) {
            try {
                fire(schedule);
                fired++;
            } catch (EtlScheduleConflictException exception) {
                LOG.warn("Schedule {} fire was not completed: {}", schedule.id(), exception.getMessage());
            } catch (RuntimeException exception) {
                // The claim expires after the lease and another round retries the schedule.
                LOG.error("Could not fire schedule {}", schedule.id(), exception);
            }
        }
        return fired;
    }

    private void fire(EtlSchedule schedule) {
        String actor = "scheduler:" + schedule.name();
        Instant now = clock.instant();
        EtlLaunch launch = run(schedule, actor, now);
        Instant nextFireAt = schedule.enabled() ? nextFire(schedule, now) : null;
        schedules.completeFire(schedule.id(), schedule.claimToken(), launch.id(), nextFireAt, actor);
        LOG.info("Schedule {} fired: launch {} {} (next {})", schedule.id(), launch.id(), launch.status(), nextFireAt);
    }

    private EtlLaunch run(EtlSchedule schedule, String actor, Instant now) {
        if (policy.isWithin(now)) {
            return skip(
                    schedule,
                    actor,
                    "El disparo cae dentro del horario operativo de la DSA (" + policy.describe() + "); no se ejecutó");
        }
        try {
            return switch (schedule.mode()) {
                case EtlSchedule.MODE_AUTO_PENDING_CLOSURES -> {
                    Optional<AcademicPeriodClosure> closure = pendingClosures.findOldestClosedPendingProcessing();
                    if (closure.isEmpty()) {
                        yield skip(schedule, actor, "No hay cierres académicos CERRADO pendientes de procesar");
                    }
                    yield launcher.launch(
                            LaunchEtlCommand.closureLoad(closure.get().id(), actor)
                                    .scheduledBy(schedule.id()));
                }
                case EtlSchedule.MODE_NO_PARAMETERS -> launcher.launch(
                        new LaunchEtlCommand(schedule.processCode(), actor, null, null, null, null, null)
                                .scheduledBy(schedule.id()));
                default -> skip(schedule, actor, "Modo de programación no soportado: " + schedule.mode());
            };
        } catch (EtlLaunchConflictException exception) {
            return skip(schedule, actor, "Ya hay una ejecución activa del proceso " + schedule.processCode());
        } catch (InvalidEtlLaunchRequestException
                | EtlProcessNotFoundException
                | AcademicClosureNotFoundException
                | EtlExecutionNotFoundException exception) {
            return skip(schedule, actor, EtlLogExcerpts.limit(exception.getMessage()));
        }
    }

    private EtlLaunch skip(EtlSchedule schedule, String actor, String reason) {
        return launches.recordSkipped(idGenerator.get(), schedule.id(), actor, reason);
    }

    private Instant nextFire(EtlSchedule schedule, Instant now) {
        try {
            return policy.nextFire(
                    policy.parseCron(schedule.cronExpression()), policy.parseZone(schedule.timezone()), now);
        } catch (InvalidEtlScheduleException exception) {
            LOG.error("Schedule {} has an invalid cron expression: {}", schedule.id(), exception.getMessage());
            return null;
        }
    }
}
