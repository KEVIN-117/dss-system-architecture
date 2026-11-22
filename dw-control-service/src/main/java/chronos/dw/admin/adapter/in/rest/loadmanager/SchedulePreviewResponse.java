package chronos.dw.admin.adapter.in.rest.loadmanager;

import chronos.dw.admin.domain.model.ScheduleOccurrence;
import java.time.Instant;
import java.util.List;

/**
 * Next occurrences of a cron expression, each flagged against the DSA operating window. valid tells whether the
 * expression would be accepted as a schedule; validationMessage explains why not.
 */
public record SchedulePreviewResponse(
        String cronExpression,
        String timezone,
        String operatingWindow,
        boolean valid,
        String validationMessage,
        List<Occurrence> occurrences) {

    public SchedulePreviewResponse {
        occurrences = List.copyOf(occurrences);
    }

    public record Occurrence(Instant at, boolean insideOperatingWindow) {

        static Occurrence from(ScheduleOccurrence occurrence) {
            return new Occurrence(occurrence.at(), occurrence.insideOperatingWindow());
        }
    }
}
