package chronos.dw.admin.adapter.in.rest.execution;

import chronos.dw.admin.domain.model.EtlExecutionDetail;
import chronos.dw.admin.domain.model.EtlExecutionKind;
import chronos.dw.admin.domain.model.EtlExecutionStatus;
import chronos.dw.admin.domain.model.EtlExecutionSummary;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record EtlExecutionDetailResponse(
        UUID runId,
        EtlExecutionKind executionKind,
        EtlExecutionStatus status,
        Long closureId,
        Integer requestedGestion,
        Integer requestedPeriodo,
        String requestedBy,
        Instant requestedAt,
        Instant startedAt,
        Instant endedAt,
        List<EtlExecutionStepResponse> steps,
        List<EtlExecutionMetricResponse> metrics,
        List<EtlExecutionErrorResponse> errors) {

    public EtlExecutionDetailResponse {
        steps = List.copyOf(steps);
        metrics = List.copyOf(metrics);
        errors = List.copyOf(errors);
    }

    public static EtlExecutionDetailResponse from(EtlExecutionDetail detail) {
        EtlExecutionSummary execution = detail.execution();
        return new EtlExecutionDetailResponse(
                execution.runId(),
                execution.executionKind(),
                execution.status(),
                execution.closureId(),
                execution.requestedGestion(),
                execution.requestedPeriodo(),
                execution.requestedBy(),
                execution.requestedAt(),
                execution.startedAt(),
                execution.endedAt(),
                detail.steps().stream().map(EtlExecutionStepResponse::from).toList(),
                detail.metrics().stream().map(EtlExecutionMetricResponse::from).toList(),
                detail.errors().stream().map(EtlExecutionErrorResponse::from).toList());
    }
}
