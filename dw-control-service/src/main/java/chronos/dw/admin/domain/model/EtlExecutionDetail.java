package chronos.dw.admin.domain.model;

import java.util.List;

public record EtlExecutionDetail(
        EtlExecutionSummary execution,
        List<EtlExecutionStep> steps,
        List<EtlExecutionMetric> metrics,
        List<SanitizedEtlExecutionError> errors) {

    public EtlExecutionDetail {
        steps = List.copyOf(steps);
        metrics = List.copyOf(metrics);
        errors = List.copyOf(errors);
    }
}
