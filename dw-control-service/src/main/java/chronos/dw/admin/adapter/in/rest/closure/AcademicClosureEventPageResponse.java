package chronos.dw.admin.adapter.in.rest.closure;

import chronos.dw.admin.application.model.ClosurePage;
import chronos.dw.admin.domain.model.AcademicPeriodClosureEvent;
import java.util.List;

/** REST representation of a page of closure audit events. */
public record AcademicClosureEventPageResponse(
        List<AcademicClosureEventResponse> items, int page, int size, long totalElements, long totalPages) {

    public AcademicClosureEventPageResponse {
        items = List.copyOf(items);
    }

    public static AcademicClosureEventPageResponse from(ClosurePage<AcademicPeriodClosureEvent> eventPage) {
        return new AcademicClosureEventPageResponse(
                eventPage.items().stream()
                        .map(AcademicClosureEventResponse::from)
                        .toList(),
                eventPage.page(),
                eventPage.size(),
                eventPage.totalElements(),
                eventPage.totalPages());
    }
}
