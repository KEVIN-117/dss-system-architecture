package chronos.dw.admin.domain.model;

import java.util.Objects;

/**
 * Technical state of a workflow execution as reported by Hop Server. The business result of a DW load stays in
 * etl_control.etl_execution.
 *
 * @param state normalized state
 * @param description raw Hop status description, for example {@code Finished (with errors)}
 * @param errorDescription Hop error description, if any
 * @param log decoded Hop log text; may be empty
 */
public record HopRunStatus(State state, String description, String errorDescription, String log) {

    public enum State {
        /** Registered or starting; not running yet. */
        WAITING,
        RUNNING,
        SUCCEEDED,
        FAILED,
        STOPPED,
        /** Hop Server no longer knows the execution (purged or server restarted). */
        NOT_FOUND
    }

    public HopRunStatus {
        Objects.requireNonNull(state, "state is required");
        log = log == null ? "" : log;
    }

    public static HopRunStatus notFound() {
        return new HopRunStatus(State.NOT_FOUND, null, null, "");
    }
}
