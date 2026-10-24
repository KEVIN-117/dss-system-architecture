package chronos.dw.admin.adapter.in.rest.closure;

import chronos.dw.admin.application.port.in.CloseAcademicPeriodUseCase;
import chronos.dw.admin.application.port.in.CreateAcademicClosureUseCase;
import chronos.dw.admin.application.port.in.GetAcademicClosureUseCase;
import chronos.dw.admin.application.port.in.ListAcademicClosureEventsUseCase;
import chronos.dw.admin.application.port.in.ListAcademicClosuresUseCase;
import chronos.dw.admin.application.port.in.ReopenAcademicPeriodUseCase;
import chronos.dw.admin.domain.model.AcademicClosureSearchCriteria;
import chronos.dw.admin.domain.model.ClosureStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    private final CreateAcademicClosureUseCase createAcademicClosure;
    private final CloseAcademicPeriodUseCase closeAcademicPeriod;
    private final ReopenAcademicPeriodUseCase reopenAcademicPeriod;

    public AcademicClosureController(
            ListAcademicClosuresUseCase listAcademicClosures,
            GetAcademicClosureUseCase getAcademicClosure,
            ListAcademicClosureEventsUseCase listAcademicClosureEvents,
            CreateAcademicClosureUseCase createAcademicClosure,
            CloseAcademicPeriodUseCase closeAcademicPeriod,
            ReopenAcademicPeriodUseCase reopenAcademicPeriod) {
        this.listAcademicClosures = listAcademicClosures;
        this.getAcademicClosure = getAcademicClosure;
        this.listAcademicClosureEvents = listAcademicClosureEvents;
        this.createAcademicClosure = createAcademicClosure;
        this.closeAcademicPeriod = closeAcademicPeriod;
        this.reopenAcademicPeriod = reopenAcademicPeriod;
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

    @PostMapping
    public ResponseEntity<AcademicClosureResponse> create(
            @Valid @RequestBody CreateAcademicClosureRequest request, @AuthenticationPrincipal Jwt jwt) {
        var closure =
                createAcademicClosure.create(request.gestion(), request.periodo(), jwt.getSubject(), request.reason());
        URI location = URI.create("/api/v1/academic-closures/" + closure.id());
        return ResponseEntity.created(location).body(AcademicClosureResponse.from(closure));
    }

    @PostMapping("/{closureId}/close")
    public AcademicClosureResponse close(
            @PathVariable @Positive long closureId,
            @Valid @RequestBody CloseAcademicPeriodRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return AcademicClosureResponse.from(
                closeAcademicPeriod.close(closureId, request.effectiveAt(), jwt.getSubject(), request.reason()));
    }

    @PostMapping("/{closureId}/reopen")
    public AcademicClosureResponse reopen(
            @PathVariable @Positive long closureId,
            @Valid @RequestBody ReopenAcademicPeriodRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return AcademicClosureResponse.from(reopenAcademicPeriod.reopen(closureId, jwt.getSubject(), request.reason()));
    }

    private static ResponseStatusException closureNotFound(long closureId) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Academic closure not found: " + closureId);
    }
}
