package chronos.dw.admin.adapter.in.rest.closure;

import chronos.dw.admin.application.port.in.GetAcademicClosureUseCase;
import chronos.dw.admin.application.port.in.ListAcademicClosureEventsUseCase;
import chronos.dw.admin.application.port.in.ListAcademicClosuresUseCase;
import chronos.dw.admin.domain.model.AcademicClosureSearchCriteria;
import chronos.dw.admin.domain.model.ClosureStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/academic-closures")
@Validated
public class AcademicClosureController {

    private static final int DEFAULT_PAGE = 0;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final ListAcademicClosuresUseCase listAcademicClosures;
    private final GetAcademicClosureUseCase getAcademicClosure;
    private final ListAcademicClosureEventsUseCase listAcademicClosureEvents;

    public AcademicClosureController(
            ListAcademicClosuresUseCase listAcademicClosures,
            GetAcademicClosureUseCase getAcademicClosure,
            ListAcademicClosureEventsUseCase listAcademicClosureEvents) {
        this.listAcademicClosures = listAcademicClosures;
        this.getAcademicClosure = getAcademicClosure;
        this.listAcademicClosureEvents = listAcademicClosureEvents;
    }

    @GetMapping
    public AcademicClosurePageResponse list(
            @RequestParam(required = false) @Min(2000) Integer gestion,
            @RequestParam(required = false) @Min(1) Integer periodo,
            @RequestParam(required = false) ClosureStatus status,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(MAX_SIZE) Integer size) {
        var criteria = new AcademicClosureSearchCriteria(gestion, periodo, status);
        return AcademicClosurePageResponse.from(listAcademicClosures.list(criteria, page, size));
    }

    @GetMapping("/{closureId}")
    public AcademicClosureResponse get(@PathVariable @Positive long closureId) {
        return getAcademicClosure
                .findById(closureId)
                .map(AcademicClosureResponse::from)
                .orElseThrow(() -> closureNotFound(closureId));
    }

    @GetMapping("/{closureId}/events")
    public AcademicClosureEventPageResponse events(
            @PathVariable @Positive long closureId,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(MAX_SIZE) Integer size) {
        if (getAcademicClosure.findById(closureId).isEmpty()) {
            throw closureNotFound(closureId);
        }
        return AcademicClosureEventPageResponse.from(listAcademicClosureEvents.list(closureId, page, size));
    }

    private static ResponseStatusException closureNotFound(long closureId) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Academic closure not found: " + closureId);
    }
}
