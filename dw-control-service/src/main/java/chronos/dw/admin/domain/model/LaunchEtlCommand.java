package chronos.dw.admin.domain.model;

import java.util.Objects;
import java.util.UUID;

/**
 * Request to run a catalog process.
 *
 * <ul>
 *   <li>{@code VERTICAL_LOAD} + {@code CIERRE_ACADEMICO}: {@code closureId} of a CERRADO closure.
 *   <li>{@code VERTICAL_LOAD} + {@code REPROCESO}: {@code retryOfRunId} of a previous execution; gestion and periodo
 *       come from it.
 *   <li>{@code PUBLISH_STAGED}: {@code runId} of an execution whose staging is sealed.
 *   <li>{@code CATALOG_SYNC}: no parameters.
 * </ul>
 *
 * @param scheduleId set only by the scheduler (LM-004)
 */
public record LaunchEtlCommand(
        String processCode,
        String actor,
        EtlExecutionKind executionKind,
        Long closureId,
        UUID retryOfRunId,
        UUID runId,
        Long scheduleId) {

    public LaunchEtlCommand {
        Objects.requireNonNull(processCode, "processCode is required");
        if (actor == null || actor.isBlank() || actor.length() > 255) {
            throw new IllegalArgumentException("actor is required (max 255 characters)");
        }
    }

    public static LaunchEtlCommand catalogSync(String actor) {
        return new LaunchEtlCommand(EtlProcess.CATALOG_SYNC, actor, null, null, null, null, null);
    }

    public static LaunchEtlCommand closureLoad(long closureId, String actor) {
        return new LaunchEtlCommand(
                EtlProcess.VERTICAL_LOAD, actor, EtlExecutionKind.CIERRE_ACADEMICO, closureId, null, null, null);
    }

    public static LaunchEtlCommand reprocess(UUID retryOfRunId, String actor) {
        return new LaunchEtlCommand(
                EtlProcess.VERTICAL_LOAD, actor, EtlExecutionKind.REPROCESO, null, retryOfRunId, null, null);
    }

    public static LaunchEtlCommand publishStaged(UUID runId, String actor) {
        return new LaunchEtlCommand(EtlProcess.PUBLISH_STAGED, actor, null, null, null, runId, null);
    }

    public LaunchEtlCommand scheduledBy(long schedule) {
        return new LaunchEtlCommand(processCode, actor, executionKind, closureId, retryOfRunId, runId, schedule);
    }
}
