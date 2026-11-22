package chronos.dw.admin.domain.model;

import java.time.Instant;

/**
 * A future fire time of a schedule.
 *
 * @param insideOperatingWindow whether it falls inside the DSA operating hours
 */
public record ScheduleOccurrence(Instant at, boolean insideOperatingWindow) {}
