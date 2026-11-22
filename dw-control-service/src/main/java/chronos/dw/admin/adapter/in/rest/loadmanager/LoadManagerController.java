package chronos.dw.admin.adapter.in.rest.loadmanager;

import chronos.dw.admin.application.port.in.LaunchEtlProcessUseCase;
import chronos.dw.admin.application.port.in.QueryLoadManagerUseCase;
import chronos.dw.admin.application.port.in.StopEtlLaunchUseCase;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchSearchCriteria;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import chronos.dw.admin.domain.model.EtlLaunchTrigger;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.net.URI;
import java.util.List;
import java.util.UUID;
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

/**
 * Load Manager API (LM-005): Hop health, process catalog, launch history and logs, and the launch and stop commands.
 * Reads require {@code dw:etl-monitor:read}; launch and stop require {@code dw:etl:execute} (SecurityConfig).
 */
@RestController
@RequestMapping("/api/v1/etl")
@Validated
public class LoadManagerController {

    private static final int MAX_SIZE = 100;

    private final QueryLoadManagerUseCase queries;
    private final LaunchEtlProcessUseCase launcher;
    private final StopEtlLaunchUseCase stopper;

    public LoadManagerController(
            QueryLoadManagerUseCase queries, LaunchEtlProcessUseCase launcher, StopEtlLaunchUseCase stopper) {
        this.queries = queries;
        this.launcher = launcher;
        this.stopper = stopper;
    }

    @GetMapping("/health")
    public LoadManagerHealthResponse health() {
        return LoadManagerHealthResponse.from(queries.health());
    }

    @GetMapping("/status")
    public EtlStatusResponse status() {
        List<EtlLaunchResponse> active =
                queries.activeLaunches().stream().map(EtlLaunchResponse::from).toList();
        return new EtlStatusResponse(!active.isEmpty(), active);
    }

    @GetMapping("/processes")
    public List<EtlProcessResponse> processes() {
        return queries.processes().stream().map(EtlProcessResponse::from).toList();
    }

    @GetMapping("/launches")
    public EtlLaunchPageResponse launches(
            @RequestParam(required = false) @Pattern(regexp = "^[A-Z][A-Z0-9_]{1,31}$") String processCode,
            @RequestParam(required = false) EtlLaunchStatus status,
            @RequestParam(required = false) EtlLaunchTrigger trigger,
            @RequestParam(required = false) @Positive Long scheduleId,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(MAX_SIZE) Integer size) {
        var criteria = new EtlLaunchSearchCriteria(processCode, status, trigger, scheduleId);
        return EtlLaunchPageResponse.from(queries.launches(criteria, page, size));
    }

    @GetMapping("/launches/{launchId}")
    public EtlLaunchResponse launch(@PathVariable UUID launchId) {
        return EtlLaunchResponse.from(queries.launch(launchId));
    }

    @GetMapping("/launches/{launchId}/logs")
    public EtlLaunchLogResponse logs(@PathVariable UUID launchId) {
        return EtlLaunchLogResponse.from(queries.launch(launchId));
    }

    /**
     * Registers the launch and submits it to Hop Server. Answers 201 with the launch; it may already be
     * {@code SUBMIT_FAILED} when Hop rejected it, and 503 when Hop could not be reached.
     */
    @PostMapping("/launches")
    public ResponseEntity<EtlLaunchResponse> launch(
            @Valid @RequestBody LaunchEtlRequest request, @AuthenticationPrincipal Jwt jwt) {
        EtlLaunch launch = launcher.launch(request.toCommand(jwt.getSubject()));
        return ResponseEntity.created(URI.create("/api/v1/etl/launches/" + launch.id()))
                .body(EtlLaunchResponse.from(launch));
    }

    /** Asks Hop to stop the run; the launch becomes STOPPED when the monitor observes it (202). */
    @PostMapping("/launches/{launchId}/stop")
    public ResponseEntity<EtlLaunchResponse> stop(@PathVariable UUID launchId, @AuthenticationPrincipal Jwt jwt) {
        EtlLaunch launch = stopper.stop(launchId, jwt.getSubject());
        return ResponseEntity.accepted().body(EtlLaunchResponse.from(launch));
    }
}
