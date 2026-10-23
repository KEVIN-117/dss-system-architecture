package chronos.dw.admin.domain.model;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Immutable audit record for a transition in an academic period closure. */
public record AcademicPeriodClosureEvent(
        long eventId,
        long closureId,
        ClosureStatus fromStatus,
        ClosureStatus toStatus,
        String actorSubject,
        String reason,
        UUID runId,
        Instant occurredAt) {

    public AcademicPeriodClosureEvent {
        if (eventId <= 0) {
            throw new IllegalArgumentException("Event id must be positive");
        }
        if (closureId <= 0) {
            throw new IllegalArgumentException("Closure id must be positive");
        }
        Objects.requireNonNull(toStatus, "toStatus is required");
        if (actorSubject == null || actorSubject.isBlank()) {
            throw new IllegalArgumentException("actorSubject is required");
        }
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("reason is required");
        }
        Objects.requireNonNull(occurredAt, "occurredAt is required");
    }
}
