package chronos.dw.admin.application.service;

import chronos.dw.admin.application.model.ExecutionPage;
import chronos.dw.admin.application.port.in.GetEtlExecutionUseCase;
import chronos.dw.admin.application.port.in.ListEtlExecutionsUseCase;
import chronos.dw.admin.application.port.out.QueryEtlExecutionsPort;
import chronos.dw.admin.domain.exception.EtlExecutionNotFoundException;
import chronos.dw.admin.domain.model.EtlExecutionDetail;
import chronos.dw.admin.domain.model.EtlExecutionError;
import chronos.dw.admin.domain.model.EtlExecutionMetric;
import chronos.dw.admin.domain.model.EtlExecutionSearchCriteria;
import chronos.dw.admin.domain.model.EtlExecutionStep;
import chronos.dw.admin.domain.model.EtlExecutionSummary;
import chronos.dw.admin.domain.model.SanitizedEtlExecutionError;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QueryEtlExecutionsService implements ListEtlExecutionsUseCase, GetEtlExecutionUseCase {

    private static final Pattern SAFE_IDENTIFIER = Pattern.compile("[A-Za-z][A-Za-z0-9_.-]{0,99}");
    private static final Pattern SAFE_ERROR_CODE = Pattern.compile("[A-Z][A-Z0-9_.-]{0,99}");

    private final QueryEtlExecutionsPort queryExecutions;

    public QueryEtlExecutionsService(QueryEtlExecutionsPort queryExecutions) {
        this.queryExecutions = queryExecutions;
    }

    @Override
    @Transactional(readOnly = true)
    public ExecutionPage<EtlExecutionSummary> list(EtlExecutionSearchCriteria criteria, int page, int size) {
        return queryExecutions.find(criteria, page, size);
    }

    @Override
    @Transactional(readOnly = true)
    public EtlExecutionDetail get(UUID runId) {
        EtlExecutionSummary execution =
                queryExecutions.findSummary(runId).orElseThrow(() -> new EtlExecutionNotFoundException(runId));

        List<EtlExecutionStep> steps = queryExecutions.findSteps(runId).stream()
                .map(QueryEtlExecutionsService::sanitizeStep)
                .toList();
        List<EtlExecutionMetric> metrics = queryExecutions.findMetrics(runId).stream()
                .map(QueryEtlExecutionsService::sanitizeMetric)
                .toList();
        List<SanitizedEtlExecutionError> errors = queryExecutions.findSanitizedErrorMetadata(runId).stream()
                .map(QueryEtlExecutionsService::sanitizeError)
                .toList();

        return new EtlExecutionDetail(execution, steps, metrics, errors);
    }

    private static EtlExecutionStep sanitizeStep(EtlExecutionStep step) {
        return new EtlExecutionStep(
                safeIdentifier(step.stepCode(), "STEP"),
                step.phase(),
                step.status(),
                step.stepOrder(),
                step.startedAt(),
                step.endedAt());
    }

    private static EtlExecutionMetric sanitizeMetric(EtlExecutionMetric metric) {
        return new EtlExecutionMetric(
                safeIdentifier(metric.name(), "ETL_METRIC"),
                metric.value(),
                safeIdentifier(metric.unit(), "UNIDAD"),
                metric.measuredAt());
    }

    private static SanitizedEtlExecutionError sanitizeError(EtlExecutionError error) {
        String safeCode =
                error.code() != null && SAFE_ERROR_CODE.matcher(error.code()).matches() ? error.code() : "ETL_ERROR";
        String safeStepCode = error.stepCode() == null ? null : safeIdentifier(error.stepCode(), "STEP");
        return new SanitizedEtlExecutionError(
                error.severity(), safeCode, safeMessage(error.severity()), safeStepCode, error.occurredAt());
    }

    private static String safeIdentifier(String value, String fallback) {
        return value != null && SAFE_IDENTIFIER.matcher(value).matches() ? value : fallback;
    }

    private static String safeMessage(String severity) {
        return switch (severity) {
            case "INFO" -> "La ejecución registró un evento informativo.";
            case "WARN" -> "La ejecución registró una advertencia. Revisa los registros técnicos.";
            default -> "La ejecución encontró un error. Revisa los registros técnicos con el equipo de operación.";
        };
    }
}
