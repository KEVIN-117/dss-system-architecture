package chronos.dw.admin.domain.model;

import java.time.Instant;
import java.util.UUID;

public record EtlExecutionSummary(
        UUID runId,
        EtlExecutionKind executionKind,
        EtlExecutionStatus status,
        Long closureId,
        Integer requestedGestion,
        Integer requestedPeriodo,
        String requestedBy,
        Instant requestedAt,
        Instant startedAt,
        Instant endedAt) {}
