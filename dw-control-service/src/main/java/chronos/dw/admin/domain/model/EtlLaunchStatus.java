package chronos.dw.admin.domain.model;

import java.util.EnumSet;
import java.util.Set;

/** Lifecycle of a Load Manager launch (etl_control.etl_launch.status). */
public enum EtlLaunchStatus {
    QUEUED,
    SUBMITTED,
    RUNNING,
    SUCCEEDED,
    FAILED,
    STOPPED,
    SKIPPED,
    SUBMIT_FAILED;

    public static final Set<EtlLaunchStatus> ACTIVE = EnumSet.of(QUEUED, SUBMITTED, RUNNING);

    public boolean isActive() {
        return ACTIVE.contains(this);
    }

    public boolean isTerminal() {
        return !isActive();
    }
}
