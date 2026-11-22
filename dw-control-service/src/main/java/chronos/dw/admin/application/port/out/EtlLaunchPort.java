package chronos.dw.admin.application.port.out;

import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistence of etl_control.etl_launch through the audited functions of migration 0065. Implementations translate
 * an active-launch conflict or an invalid transition into {@code EtlLaunchConflictException}.
 */
public interface EtlLaunchPort {

    EtlLaunch request(
            UUID launchId,
            String processCode,
            String requestedBy,
            Map<String, String> parameters,
            Long closureId,
            UUID runId,
            Long scheduleId);

    EtlLaunch transition(
            UUID launchId,
            EtlLaunchStatus target,
            String actor,
            UUID hopExecutionId,
            String resultSummary,
            String logExcerpt);

    EtlLaunch requestStop(UUID launchId, String actor);

    Optional<EtlLaunch> findById(UUID launchId);

    /** Active launches (QUEUED, SUBMITTED, RUNNING), oldest first. */
    List<EtlLaunch> findActive(int limit);
}
