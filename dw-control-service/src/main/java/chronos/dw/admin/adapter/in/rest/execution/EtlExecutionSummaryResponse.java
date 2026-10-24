package chronos.dw.admin.adapter.in.rest.execution;

import chronos.dw.admin.domain.model.EtlExecutionKind;
import chronos.dw.admin.domain.model.EtlExecutionStatus;
import chronos.dw.admin.domain.model.EtlExecutionSummary;
import java.time.Instant;
import java.util.UUID;

public record EtlExecutionSummaryResponse(
        UUID runId,
        EtlExecutionKind executionKind,
        EtlExecutionStatus status,
        Long closureId,
        Integer requestedGestion,
        Integer requestedPeriodo,
        String requestedBy,
        Instant requestedAt,
        Instant startedAt,
        Instant endedAt) {

    public static EtlExecutionSummaryResponse from(EtlExecutionSummary execution) {
        return new EtlExecutionSummaryResponse(
                execution.runId(),
                execution.executionKind(),
                execution.status(),
                execution.closureId(),
                execution.requestedGestion(),
                execution.requestedPeriodo(),
                execution.requestedBy(),
                execution.requestedAt(),
                execution.startedAt(),
                execution.endedAt());
    }
}
