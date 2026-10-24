package chronos.dw.admin.adapter.in.rest.execution;

import chronos.dw.admin.domain.model.SanitizedEtlExecutionError;
import java.time.Instant;

public record EtlExecutionErrorResponse(
        String severity, String code, String message, String stepCode, Instant occurredAt) {

    public static EtlExecutionErrorResponse from(SanitizedEtlExecutionError error) {
        return new EtlExecutionErrorResponse(
                error.severity(), error.code(), error.message(), error.stepCode(), error.occurredAt());
    }
}
