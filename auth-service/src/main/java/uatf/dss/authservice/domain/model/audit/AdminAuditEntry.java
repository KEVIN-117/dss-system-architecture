package uatf.dss.authservice.domain.model.audit;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * One row of the administrative audit log. {@code before} and {@code after} are JSON-friendly snapshots of the
 * target and are always passed through {@link AuditPayloadSanitizer}, so secrets never reach storage.
 */
public record AdminAuditEntry(
        UUID id,
        Instant occurredAt,
        AuditActor actor,
        String action,
        AuditTargetType targetType,
        String targetId,
        Map<String, Object> before,
        Map<String, Object> after,
        AuditOutcome outcome,
        String failureReason,
        Instant completedAt) {

    public static final int MAX_FAILURE_REASON = 1000;

    public AdminAuditEntry {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(occurredAt, "occurredAt");
        Objects.requireNonNull(targetType, "targetType");
        Objects.requireNonNull(outcome, "outcome");
        if (action == null || action.isBlank()) {
            throw new IllegalArgumentException("action is required");
        }
        actor = actor == null ? AuditActor.SYSTEM : actor;
        before = AuditPayloadSanitizer.sanitize(before);
        after = AuditPayloadSanitizer.sanitize(after);
        failureReason = truncate(failureReason);
    }

    public AdminAuditEntry completed(AuditOutcome result, Map<String, Object> afterState, String reason, Instant at) {
        return new AdminAuditEntry(id, occurredAt, actor, action, targetType, targetId, before, afterState, result,
                reason, at);
    }

    private static String truncate(String value) {
        if (value == null || value.length() <= MAX_FAILURE_REASON) {
            return value;
        }
        return value.substring(0, MAX_FAILURE_REASON - 1) + "…";
    }
}
