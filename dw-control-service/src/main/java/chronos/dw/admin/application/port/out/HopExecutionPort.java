package chronos.dw.admin.application.port.out;

import chronos.dw.admin.domain.model.HopRunStatus;
import java.util.Map;
import java.util.UUID;

/**
 * Execution engine of the Load Manager (Hop Server, see docs/dw/hop-server-contract.md). Implementations throw
 * {@code HopUnavailableException} when the server cannot be reached and {@code HopRequestRejectedException} when it
 * rejects a request.
 */
public interface HopExecutionPort {

    /** Hop Server status description (for example {@code Online}). */
    String serverStatus();

    /**
     * Registers and starts a project workflow.
     *
     * @param workflowFile path relative to the project home, for example {@code workflows/wf_x.hwf}
     * @param parameters Hop parameters of the workflow
     * @return Hop execution id
     */
    UUID submit(String workflowFile, Map<String, String> parameters);

    HopRunStatus status(UUID hopExecutionId);

    void stop(UUID hopExecutionId);

    /** Frees a finished execution from Hop Server memory. Best effort. */
    void remove(UUID hopExecutionId);
}
