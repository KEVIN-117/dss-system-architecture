package chronos.dw.admin.adapter.in.rest.closure;

import chronos.dw.admin.application.model.ClosurePage;
import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import java.util.List;

/** REST representation of a page of academic period closures. */
public record AcademicClosurePageResponse(
        List<AcademicClosureResponse> items, int page, int size, long totalElements, long totalPages) {

    public AcademicClosurePageResponse {
        items = List.copyOf(items);
    }

    public static AcademicClosurePageResponse from(ClosurePage<AcademicPeriodClosure> closurePage) {
        return new AcademicClosurePageResponse(
                closurePage.items().stream().map(AcademicClosureResponse::from).toList(),
                closurePage.page(),
                closurePage.size(),
                closurePage.totalElements(),
                closurePage.totalPages());
    }
}
