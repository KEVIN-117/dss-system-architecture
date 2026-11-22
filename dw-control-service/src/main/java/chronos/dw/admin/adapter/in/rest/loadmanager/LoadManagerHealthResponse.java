package chronos.dw.admin.adapter.in.rest.loadmanager;

import chronos.dw.admin.domain.model.LoadManagerHealth;
import java.time.Instant;

/** Hop Server reachability and the Load Manager switches of this instance. */
public record LoadManagerHealthResponse(
        boolean hopOnline,
        String hopStatus,
        boolean monitoringEnabled,
        boolean schedulerEnabled,
        String operatingWindow,
        Instant checkedAt) {

    static LoadManagerHealthResponse from(LoadManagerHealth health) {
        return new LoadManagerHealthResponse(
                health.hopOnline(),
                health.hopStatus(),
                health.monitoringEnabled(),
                health.schedulerEnabled(),
                health.operatingWindow(),
                health.checkedAt());
    }
}
