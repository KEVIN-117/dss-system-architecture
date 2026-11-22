package chronos.dw.admin.application.port.out;

import chronos.dw.admin.domain.model.EtlSchedule;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistence of etl_control.etl_schedule through the audited functions of migration 0065. Implementations translate
 * duplicate names, stale versions and claimed schedules into {@code EtlScheduleConflictException}, missing rows into
 * {@code EtlScheduleNotFoundException} and invalid values into {@code InvalidEtlScheduleException}.
 */
public interface EtlSchedulePort {

    EtlSchedule create(
            String processCode,
            String name,
            String cronExpression,
            String timezone,
            Instant nextFireAt,
            boolean enabled,
            String actor);

    EtlSchedule update(
            long scheduleId,
            int expectedRowVersion,
            String name,
            String cronExpression,
            String timezone,
            Instant nextFireAt,
            String actor);

    EtlSchedule setEnabled(long scheduleId, int expectedRowVersion, boolean enabled, Instant nextFireAt, String actor);

    EtlSchedule delete(long scheduleId, int expectedRowVersion, String actor);

    Optional<EtlSchedule> findById(long scheduleId);

    /** Live (not deleted) schedules ordered by name. */
    List<EtlSchedule> findAll();

    /** Claims due schedules for this instance (FOR UPDATE SKIP LOCKED + lease). */
    List<EtlSchedule> claimDue(int limit, int leaseSeconds);

    /** Closes a claimed fire with the launch it produced (or the skipped one) and moves next_fire_at. */
    EtlSchedule completeFire(long scheduleId, UUID claimToken, UUID launchId, Instant nextFireAt, String actor);
}
