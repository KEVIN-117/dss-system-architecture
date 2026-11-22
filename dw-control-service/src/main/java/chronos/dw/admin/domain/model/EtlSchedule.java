package chronos.dw.admin.domain.model;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Immutable view of etl_control.etl_schedule (migration 0064). */
public record EtlSchedule(
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
        UUID claimToken,
        Instant claimedUntil,
        String createdBy,
        Instant createdAt,
        String updatedBy,
        Instant updatedAt,
        Instant deletedAt,
        int rowVersion) {

    public static final String MODE_AUTO_PENDING_CLOSURES = "AUTO_PENDING_CLOSURES";
    public static final String MODE_NO_PARAMETERS = "NO_PARAMETERS";

    public EtlSchedule {
        Objects.requireNonNull(processCode, "processCode is required");
        Objects.requireNonNull(name, "name is required");
        Objects.requireNonNull(cronExpression, "cronExpression is required");
        Objects.requireNonNull(timezone, "timezone is required");
        Objects.requireNonNull(mode, "mode is required");
    }

    public boolean deleted() {
        return deletedAt != null;
    }
}
