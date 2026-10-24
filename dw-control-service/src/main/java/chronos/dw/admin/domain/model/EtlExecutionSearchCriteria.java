package chronos.dw.admin.domain.model;

public record EtlExecutionSearchCriteria(
        EtlExecutionStatus status, EtlExecutionKind executionKind, Integer gestion, Integer periodo, Long closureId) {

    public EtlExecutionSearchCriteria {
        if (gestion != null && (gestion < 2000 || gestion > 32767)) {
            throw new IllegalArgumentException("Gestion must be between 2000 and 32767");
        }
        if (periodo != null && (periodo < 1 || periodo > 32767)) {
            throw new IllegalArgumentException("Periodo must be between 1 and 32767");
        }
        if (closureId != null && closureId <= 0) {
            throw new IllegalArgumentException("Closure id must be positive");
        }
    }
}
