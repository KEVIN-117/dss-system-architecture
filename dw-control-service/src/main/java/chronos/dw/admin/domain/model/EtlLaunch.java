package chronos.dw.admin.domain.model;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Immutable view of etl_control.etl_launch. */
public record EtlLaunch(
        UUID id,
        String processCode,
        EtlLaunchTrigger trigger,
        Long scheduleId,
        Long closureId,
        UUID runId,
        Map<String, String> parameters,
        EtlLaunchStatus status,
        UUID hopExecutionId,
        String requestedBy,
        Instant requestedAt,
        Instant submittedAt,
        Instant startedAt,
        Instant finishedAt,
        String stopRequestedBy,
        Instant stopRequestedAt,
        String resultSummary,
        String logExcerpt,
        int rowVersion) {

    public EtlLaunch {
        Objects.requireNonNull(id, "id is required");
        Objects.requireNonNull(processCode, "processCode is required");
        Objects.requireNonNull(trigger, "trigger is required");
        Objects.requireNonNull(status, "status is required");
        Objects.requireNonNull(requestedAt, "requestedAt is required");
        parameters = parameters == null ? Map.of() : Map.copyOf(parameters);
    }

    public boolean stopRequested() {
        return stopRequestedAt != null;
    }
}
