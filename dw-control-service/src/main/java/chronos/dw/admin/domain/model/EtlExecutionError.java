package chronos.dw.admin.domain.model;

import java.time.Instant;

/** Raw code metadata read for sanitization; cause, message, and JSON details are never loaded. */
public record EtlExecutionError(String severity, String code, String stepCode, Instant occurredAt) {}
