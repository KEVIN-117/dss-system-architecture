package chronos.dw.admin.adapter.in.rest.execution;

import chronos.dw.admin.application.model.ExecutionPage;
import chronos.dw.admin.domain.model.EtlExecutionSummary;
import java.util.List;

public record EtlExecutionPageResponse(
        List<EtlExecutionSummaryResponse> items, int page, int size, long totalElements, long totalPages) {

    public EtlExecutionPageResponse {
        items = List.copyOf(items);
    }

    public static EtlExecutionPageResponse from(ExecutionPage<EtlExecutionSummary> executionPage) {
        return new EtlExecutionPageResponse(
                executionPage.items().stream()
                        .map(EtlExecutionSummaryResponse::from)
                        .toList(),
                executionPage.page(),
                executionPage.size(),
                executionPage.totalElements(),
                executionPage.totalPages());
    }
}
