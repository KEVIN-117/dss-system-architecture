package chronos.dw.admin.domain.model;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Immutable domain representation of etl_control.academic_period_closure. */
public record AcademicPeriodClosure(
        long id,
        int gestion,
        int periodo,
        ClosureStatus status,
        Instant effectiveAt,
        String authorizedBySubject,
        String createdBySubject,
        String reason,
        int version,
        UUID processedRunId,
        Instant processedAt,
        Instant createdAt,
        Instant updatedAt) {

    public AcademicPeriodClosure {
        if (id < 0) {
            throw new IllegalArgumentException("Closure id cannot be negative");
        }
        if (gestion < 2000) {
            throw new IllegalArgumentException("Gestion must be 2000 or later");
        }
        if (periodo <= 0) {
            throw new IllegalArgumentException("Periodo must be positive");
        }
        Objects.requireNonNull(status, "status is required");
        requireText(createdBySubject, "createdBySubject");
        requireText(reason, "reason");
        if (version <= 0) {
            throw new IllegalArgumentException("Version must be positive");
        }
        if (status == ClosureStatus.CERRADO && (effectiveAt == null || isBlank(authorizedBySubject))) {
            throw new IllegalArgumentException("A closed period requires authorization and effectiveAt");
        }
        if (status == ClosureStatus.PROCESADO && (processedRunId == null || processedAt == null)) {
            throw new IllegalArgumentException("A processed period requires run id and processedAt");
        }
    }

    private static void requireText(String value, String name) {
        if (isBlank(value)) {
            throw new IllegalArgumentException(name + " is required");
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
