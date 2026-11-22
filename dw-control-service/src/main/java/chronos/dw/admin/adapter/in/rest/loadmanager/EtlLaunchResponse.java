package chronos.dw.admin.adapter.in.rest.loadmanager;

import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import chronos.dw.admin.domain.model.EtlLaunchTrigger;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** A Load Manager launch. The Hop log is served separately by the logs endpoint. */
public record EtlLaunchResponse(
        UUID id,
        String processCode,
        EtlLaunchTrigger trigger,
        Long scheduleId,
        Long closureId,
        UUID runId,
        Map<String, String> parameters,
        EtlLaunchStatus status,
        boolean active,
        UUID hopExecutionId,
        String requestedBy,
        Instant requestedAt,
        Instant submittedAt,
        Instant startedAt,
        Instant finishedAt,
        String stopRequestedBy,
        Instant stopRequestedAt,
        String resultSummary,
        int rowVersion) {

    static EtlLaunchResponse from(EtlLaunch launch) {
        return new EtlLaunchResponse(
                launch.id(),
                launch.processCode(),
                launch.trigger(),
                launch.scheduleId(),
                launch.closureId(),
                launch.runId(),
                launch.parameters(),
                launch.status(),
                launch.status().isActive(),
                launch.hopExecutionId(),
                launch.requestedBy(),
                launch.requestedAt(),
                launch.submittedAt(),
                launch.startedAt(),
                launch.finishedAt(),
                launch.stopRequestedBy(),
                launch.stopRequestedAt(),
                launch.resultSummary(),
                launch.rowVersion());
    }
}
