package chronos.dw.admin.adapter.in.rest.closure;

import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import chronos.dw.admin.domain.model.ClosureStatus;
import java.time.Instant;
import java.util.UUID;

/** REST representation of an academic period closure. */
public record AcademicClosureResponse(
        long closureId,
        int gestion,
        int periodo,
        ClosureStatus status,
        Instant effectiveAt,
        String authorizedBySubject,
        String createdBySubject,
        String closureReason,
        int version,
        UUID processedRunId,
        Instant processedAt,
        Instant createdAt,
        Instant updatedAt) {

    public static AcademicClosureResponse from(AcademicPeriodClosure closure) {
        return new AcademicClosureResponse(
                closure.id(),
                closure.gestion(),
                closure.periodo(),
                closure.status(),
                closure.effectiveAt(),
                closure.authorizedBySubject(),
                closure.createdBySubject(),
                closure.reason(),
                closure.version(),
                closure.processedRunId(),
                closure.processedAt(),
                closure.createdAt(),
                closure.updatedAt());
    }
}
