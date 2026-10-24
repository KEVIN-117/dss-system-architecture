package chronos.dw.admin.application.port.in;

import chronos.dw.admin.application.model.ExecutionPage;
import chronos.dw.admin.domain.model.EtlExecutionSearchCriteria;
import chronos.dw.admin.domain.model.EtlExecutionSummary;

public interface ListEtlExecutionsUseCase {

    ExecutionPage<EtlExecutionSummary> list(EtlExecutionSearchCriteria criteria, int page, int size);
}
