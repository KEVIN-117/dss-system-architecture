package chronos.dw.admin.adapter.in.rest.loadmanager;

import chronos.dw.admin.domain.model.EtlSchedule;
import java.time.Instant;
import java.util.UUID;

/** A Load Manager schedule. firing is true while an instance holds its fire claim. */
public record EtlScheduleResponse(
        long id,
        String processCode,
        String name,
        String cronExpression,
        String timezone,
        String mode,
        boolean enabled,
        Instant nextFireAt,
        Instant lastFiredAt,
        UUID lastLaunchId,
        boolean firing,
        String createdBy,
        Instant createdAt,
        String updatedBy,
        Instant updatedAt,
        int rowVersion) {

    static EtlScheduleResponse from(EtlSchedule schedule, Instant now) {
        return new EtlScheduleResponse(
                schedule.id(),
                schedule.processCode(),
                schedule.name(),
                schedule.cronExpression(),
                schedule.timezone(),
                schedule.mode(),
                schedule.enabled(),
                schedule.nextFireAt(),
                schedule.lastFiredAt(),
                schedule.lastLaunchId(),
                schedule.claimedUntil() != null && schedule.claimedUntil().isAfter(now),
                schedule.createdBy(),
                schedule.createdAt(),
                schedule.updatedBy(),
                schedule.updatedAt(),
                schedule.rowVersion());
    }
}
