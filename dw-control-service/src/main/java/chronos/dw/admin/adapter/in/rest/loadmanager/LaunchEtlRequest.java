package chronos.dw.admin.adapter.in.rest.loadmanager;

import chronos.dw.admin.domain.model.EtlExecutionKind;
import chronos.dw.admin.domain.model.LaunchEtlCommand;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.util.UUID;

/**
 * Launch a catalog process.
 *
 * <ul>
 *   <li>VERTICAL_LOAD: executionKind CIERRE_ACADEMICO with closureId, or REPROCESO with retryOfRunId.
 *   <li>PUBLISH_STAGED: runId.
 *   <li>CATALOG_SYNC: nothing else.
 * </ul>
 */
public record LaunchEtlRequest(
        @NotBlank @Pattern(regexp = "^[A-Z][A-Z0-9_]{1,31}$") String processCode,
        EtlExecutionKind executionKind,
        @Positive Long closureId,
        UUID retryOfRunId,
        UUID runId) {

    LaunchEtlCommand toCommand(String actor) {
        return new LaunchEtlCommand(processCode, actor, executionKind, closureId, retryOfRunId, runId, null);
    }
}
