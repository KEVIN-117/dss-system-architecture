package chronos.dw.admin.domain.model;

import java.time.Instant;

public record SanitizedEtlExecutionError(
        String severity, String code, String message, String stepCode, Instant occurredAt) {}
