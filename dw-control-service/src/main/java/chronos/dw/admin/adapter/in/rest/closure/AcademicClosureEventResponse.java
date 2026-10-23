package chronos.dw.admin.adapter.in.rest.closure;

import chronos.dw.admin.domain.model.AcademicPeriodClosureEvent;
import chronos.dw.admin.domain.model.ClosureStatus;
import java.time.Instant;
import java.util.UUID;

/** REST representation of an immutable academic closure audit event. */
public record AcademicClosureEventResponse(
        long eventId,
        long closureId,
        ClosureStatus fromStatus,
        ClosureStatus toStatus,
        String actorSubject,
        String reason,
        UUID runId,
        Instant occurredAt) {

    public static AcademicClosureEventResponse from(AcademicPeriodClosureEvent event) {
        return new AcademicClosureEventResponse(
                event.eventId(),
                event.closureId(),
                event.fromStatus(),
                event.toStatus(),
                event.actorSubject(),
                event.reason(),
                event.runId(),
                event.occurredAt());
    }
}
