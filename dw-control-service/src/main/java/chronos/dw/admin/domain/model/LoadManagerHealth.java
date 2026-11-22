package chronos.dw.admin.domain.model;

import java.time.Instant;

/**
 * Load Manager status for the portal.
 *
 * @param hopOnline whether Hop Server answered its status request
 * @param hopStatus Hop status description, or {@code null} when unreachable
 * @param monitoringEnabled whether this instance runs the launch monitor
 * @param schedulerEnabled whether this instance fires schedules
 * @param operatingWindow human description of the DSA operating hours
 */
public record LoadManagerHealth(
        boolean hopOnline,
        String hopStatus,
        boolean monitoringEnabled,
        boolean schedulerEnabled,
        String operatingWindow,
        Instant checkedAt) {}
