package chronos.dw.admin.adapter.in.rest.execution;

import chronos.dw.admin.application.port.in.GetEtlExecutionUseCase;
import chronos.dw.admin.application.port.in.ListEtlExecutionsUseCase;
import chronos.dw.admin.domain.model.EtlExecutionKind;
import chronos.dw.admin.domain.model.EtlExecutionSearchCriteria;
import chronos.dw.admin.domain.model.EtlExecutionStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import java.util.UUID;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/etl/executions")
@Validated
public class EtlExecutionController {

    private static final int MAX_SIZE = 100;

    private final ListEtlExecutionsUseCase listExecutions;
    private final GetEtlExecutionUseCase getExecution;

    public EtlExecutionController(ListEtlExecutionsUseCase listExecutions, GetEtlExecutionUseCase getExecution) {
        this.listExecutions = listExecutions;
        this.getExecution = getExecution;
    }

    @GetMapping
    public EtlExecutionPageResponse list(
            @RequestParam(required = false) EtlExecutionStatus status,
            @RequestParam(required = false) EtlExecutionKind executionKind,
            @RequestParam(required = false) @Min(2000) @Max(32767) Integer gestion,
            @RequestParam(required = false) @Min(1) @Max(32767) Integer periodo,
            @RequestParam(required = false) @Positive Long closureId,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(MAX_SIZE) Integer size) {
        var criteria = new EtlExecutionSearchCriteria(status, executionKind, gestion, periodo, closureId);
        return EtlExecutionPageResponse.from(listExecutions.list(criteria, page, size));
    }

    @GetMapping("/{runId}")
    public EtlExecutionDetailResponse get(@PathVariable UUID runId) {
        return EtlExecutionDetailResponse.from(getExecution.get(runId));
    }
}
