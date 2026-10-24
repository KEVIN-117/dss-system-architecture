package chronos.dw.admin.application.port.out;

import chronos.dw.admin.application.model.ExecutionPage;
import chronos.dw.admin.domain.model.EtlExecutionError;
import chronos.dw.admin.domain.model.EtlExecutionMetric;
import chronos.dw.admin.domain.model.EtlExecutionSearchCriteria;
import chronos.dw.admin.domain.model.EtlExecutionStep;
import chronos.dw.admin.domain.model.EtlExecutionSummary;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface QueryEtlExecutionsPort {

    ExecutionPage<EtlExecutionSummary> find(EtlExecutionSearchCriteria criteria, int page, int size);

    Optional<EtlExecutionSummary> findSummary(UUID runId);

    List<EtlExecutionStep> findSteps(UUID runId);

    List<EtlExecutionMetric> findMetrics(UUID runId);

    List<EtlExecutionError> findSanitizedErrorMetadata(UUID runId);
}
