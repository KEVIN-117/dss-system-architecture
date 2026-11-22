package chronos.dw.admin.application.service;

import chronos.dw.admin.application.port.out.EtlSchedulePort;
import chronos.dw.admin.domain.exception.EtlScheduleConflictException;
import chronos.dw.admin.domain.exception.EtlScheduleNotFoundException;
import chronos.dw.admin.domain.model.EtlSchedule;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** In-memory EtlSchedulePort mirroring the version and claim rules of migration 0065. */
final class ScheduleFakes {

    private ScheduleFakes() {}

    static final class Schedules implements EtlSchedulePort {

        final Map<Long, EtlSchedule> rows = new LinkedHashMap<>();
        final List<String> completed = new ArrayList<>();
        private final Clock clock;
        private long sequence = 1;

        Schedules(Clock clock) {
            this.clock = clock;
        }

        EtlSchedule put(EtlSchedule schedule) {
            rows.put(schedule.id(), schedule);
            return schedule;
        }

        @Override
        public EtlSchedule create(
                String processCode,
                String name,
                String cronExpression,
                String timezone,
                Instant nextFireAt,
                boolean enabled,
                String actor) {
            String mode = processCode.equals("VERTICAL_LOAD")
                    ? EtlSchedule.MODE_AUTO_PENDING_CLOSURES
                    : EtlSchedule.MODE_NO_PARAMETERS;
            return put(schedule(
                    sequence++,
                    processCode,
                    name,
                    cronExpression,
                    timezone,
                    mode,
                    enabled,
                    nextFireAt,
                    null,
                    1,
                    actor));
        }

        @Override
        public EtlSchedule update(
                long scheduleId,
                int expectedRowVersion,
                String name,
                String cronExpression,
                String timezone,
                Instant nextFireAt,
                String actor) {
            EtlSchedule current = check(scheduleId, expectedRowVersion);
            return put(schedule(
                    scheduleId,
                    current.processCode(),
                    name,
                    cronExpression,
                    timezone,
                    current.mode(),
                    current.enabled(),
                    nextFireAt,
                    null,
                    current.rowVersion() + 1,
                    actor));
        }

        @Override
        public EtlSchedule setEnabled(
                long scheduleId, int expectedRowVersion, boolean enabled, Instant nextFireAt, String actor) {
            EtlSchedule current = check(scheduleId, expectedRowVersion);
            return put(schedule(
                    scheduleId,
                    current.processCode(),
                    current.name(),
                    current.cronExpression(),
                    current.timezone(),
                    current.mode(),
                    enabled,
                    nextFireAt,
                    null,
                    current.rowVersion() + 1,
                    actor));
        }

        @Override
        public EtlSchedule delete(long scheduleId, int expectedRowVersion, String actor) {
            check(scheduleId, expectedRowVersion);
            return rows.remove(scheduleId);
        }

        @Override
        public Optional<EtlSchedule> findById(long scheduleId) {
            return Optional.ofNullable(rows.get(scheduleId));
        }

        @Override
        public List<EtlSchedule> findAll() {
            return List.copyOf(rows.values());
        }

        @Override
        public List<EtlSchedule> claimDue(int limit, int leaseSeconds) {
            Instant now = clock.instant();
            List<EtlSchedule> claimed = new ArrayList<>();
            for (EtlSchedule row : List.copyOf(rows.values())) {
                if (row.enabled()
                        && row.nextFireAt() != null
                        && !row.nextFireAt().isAfter(now)
                        && row.claimToken() == null
                        && claimed.size() < limit) {
                    EtlSchedule withClaim = new EtlSchedule(
                            row.id(),
                            row.processCode(),
                            row.name(),
                            row.cronExpression(),
                            row.timezone(),
                            row.mode(),
                            row.enabled(),
                            row.nextFireAt(),
                            row.lastFiredAt(),
                            row.lastLaunchId(),
                            UUID.randomUUID(),
                            now.plusSeconds(leaseSeconds),
                            row.createdBy(),
                            row.createdAt(),
                            row.updatedBy(),
                            row.updatedAt(),
                            null,
                            row.rowVersion());
                    put(withClaim);
                    claimed.add(withClaim);
                }
            }
            return claimed;
        }

        @Override
        public EtlSchedule completeFire(
                long scheduleId, UUID claimToken, UUID launchId, Instant nextFireAt, String actor) {
            EtlSchedule current = rows.get(scheduleId);
            if (current.claimToken() == null || !current.claimToken().equals(claimToken)) {
                throw new EtlScheduleConflictException("claim lost", null);
            }
            completed.add(scheduleId + ":" + launchId + ":" + nextFireAt);
            return put(new EtlSchedule(
                    current.id(),
                    current.processCode(),
                    current.name(),
                    current.cronExpression(),
                    current.timezone(),
                    current.mode(),
                    current.enabled(),
                    nextFireAt,
                    clock.instant(),
                    launchId,
                    null,
                    null,
                    current.createdBy(),
                    current.createdAt(),
                    current.updatedBy(),
                    current.updatedAt(),
                    null,
                    current.rowVersion()));
        }

        private EtlSchedule check(long scheduleId, int expectedRowVersion) {
            EtlSchedule current = rows.get(scheduleId);
            if (current == null) {
                throw new EtlScheduleNotFoundException(scheduleId);
            }
            if (current.rowVersion() != expectedRowVersion) {
                throw new EtlScheduleConflictException("stale", null);
            }
            return current;
        }

        private EtlSchedule schedule(
                long id,
                String processCode,
                String name,
                String cron,
                String timezone,
                String mode,
                boolean enabled,
                Instant nextFireAt,
                UUID claimToken,
                int rowVersion,
                String actor) {
            Instant now = clock.instant();
            return new EtlSchedule(
                    id,
                    processCode,
                    name,
                    cron,
                    timezone,
                    mode,
                    enabled,
                    nextFireAt,
                    null,
                    null,
                    claimToken,
                    claimToken == null ? null : now.plusSeconds(300),
                    actor,
                    now,
                    actor,
                    now,
                    null,
                    rowVersion);
        }
    }
}
