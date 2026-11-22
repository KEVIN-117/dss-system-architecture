package chronos.dw.admin.adapter.in.rest.loadmanager;

import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import java.util.UUID;

/** Sanitized tail of the Hop log of a launch (at most 64 KiB), refreshed by the monitor. */
public record EtlLaunchLogResponse(UUID launchId, EtlLaunchStatus status, boolean active, String log) {

    static EtlLaunchLogResponse from(EtlLaunch launch) {
        return new EtlLaunchLogResponse(
                launch.id(),
                launch.status(),
                launch.status().isActive(),
                launch.logExcerpt() == null ? "" : launch.logExcerpt());
    }
}
