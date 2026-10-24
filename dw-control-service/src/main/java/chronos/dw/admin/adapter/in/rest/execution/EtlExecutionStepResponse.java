package chronos.dw.admin.adapter.in.rest.execution;

import chronos.dw.admin.domain.model.EtlExecutionStep;
import java.time.Instant;

public record EtlExecutionStepResponse(
        String stepCode, String phase, String status, int stepOrder, Instant startedAt, Instant endedAt) {

    public static EtlExecutionStepResponse from(EtlExecutionStep step) {
        return new EtlExecutionStepResponse(
                step.stepCode(), step.phase(), step.status(), step.stepOrder(), step.startedAt(), step.endedAt());
    }
}
