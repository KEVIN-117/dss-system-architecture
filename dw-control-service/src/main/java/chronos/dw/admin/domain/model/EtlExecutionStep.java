package chronos.dw.admin.domain.model;

import java.time.Instant;

public record EtlExecutionStep(
        String stepCode, String phase, String status, int stepOrder, Instant startedAt, Instant endedAt) {}
