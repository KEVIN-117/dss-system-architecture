package chronos.dw.admin.adapter.in.rest.loadmanager;

import chronos.dw.admin.application.model.ExecutionPage;
import chronos.dw.admin.domain.model.EtlLaunch;
import java.util.List;

/** A page of the launch history, newest first. */
public record EtlLaunchPageResponse(
        List<EtlLaunchResponse> items, int page, int size, long totalElements, long totalPages) {

    public EtlLaunchPageResponse {
        items = List.copyOf(items);
    }

    static EtlLaunchPageResponse from(ExecutionPage<EtlLaunch> page) {
        return new EtlLaunchPageResponse(
                page.items().stream().map(EtlLaunchResponse::from).toList(),
                page.page(),
                page.size(),
                page.totalElements(),
                page.totalPages());
    }
}
