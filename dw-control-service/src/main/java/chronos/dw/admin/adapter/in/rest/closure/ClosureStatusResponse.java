package chronos.dw.admin.adapter.in.rest.closure;

import chronos.dw.admin.domain.model.ClosureStatus;

/** REST representation of a closure lifecycle status. */
public record ClosureStatusResponse(String code) {

    public static ClosureStatusResponse from(ClosureStatus status) {
        return new ClosureStatusResponse(status.name());
    }
}
