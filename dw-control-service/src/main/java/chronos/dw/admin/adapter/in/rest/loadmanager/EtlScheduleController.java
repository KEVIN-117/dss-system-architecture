package chronos.dw.admin.adapter.in.rest.loadmanager;

import chronos.dw.admin.application.port.in.ManageEtlSchedulesUseCase;
import chronos.dw.admin.application.service.OperatingWindowPolicy;
import chronos.dw.admin.domain.model.EtlSchedule;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Load Manager schedules (LM-004/LM-005). Reads require {@code dw:etl-monitor:read}; changes require {@code
 * dw:etl-schedule:manage} (SecurityConfig). The fire history of a schedule is {@code GET
 * /api/v1/etl/launches?scheduleId=}.
 */
@RestController
@RequestMapping("/api/v1/etl/schedules")
@Validated
public class EtlScheduleController {

    private final ManageEtlSchedulesUseCase schedules;
    private final OperatingWindowPolicy operatingWindow;
    private final Clock clock;

    public EtlScheduleController(
            ManageEtlSchedulesUseCase schedules, OperatingWindowPolicy operatingWindow, Clock clock) {
        this.schedules = schedules;
        this.operatingWindow = operatingWindow;
        this.clock = clock;
    }

    @GetMapping
    public List<EtlScheduleResponse> list() {
        return schedules.list().stream().map(this::response).toList();
    }

    @GetMapping("/{scheduleId}")
    public EtlScheduleResponse get(@PathVariable @Positive long scheduleId) {
        return response(schedules.get(scheduleId));
    }

    /** Next occurrences of an expression and whether it would be accepted. Does not store anything. */
    @GetMapping("/preview")
    public SchedulePreviewResponse preview(
            @RequestParam @NotBlank @Size(max = 120) String cronExpression,
            @RequestParam(required = false) @Size(max = 64) String timezone,
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) Integer count) {
        var occurrences = schedules.preview(cronExpression, timezone, count).stream()
                .map(SchedulePreviewResponse.Occurrence::from)
                .toList();
        Optional<String> error = schedules.validationError(cronExpression, timezone);
        return new SchedulePreviewResponse(
                cronExpression.trim(),
                operatingWindow.parseZone(timezone).getId(),
                operatingWindow.describe(),
                error.isEmpty(),
                error.orElse(null),
                occurrences);
    }

    @PostMapping
    public ResponseEntity<EtlScheduleResponse> create(
            @Valid @RequestBody CreateEtlScheduleRequest request, @AuthenticationPrincipal Jwt jwt) {
        EtlSchedule created = schedules.create(request.toDefinition(), jwt.getSubject());
        return ResponseEntity.created(URI.create("/api/v1/etl/schedules/" + created.id()))
                .body(response(created));
    }

    @PutMapping("/{scheduleId}")
    public EtlScheduleResponse update(
            @PathVariable @Positive long scheduleId,
            @Valid @RequestBody UpdateEtlScheduleRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return response(schedules.update(scheduleId, request.rowVersion(), request.toDefinition(), jwt.getSubject()));
    }

    @PostMapping("/{scheduleId}/enable")
    public EtlScheduleResponse enable(
            @PathVariable @Positive long scheduleId,
            @Valid @RequestBody EtlScheduleVersionRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return response(schedules.setEnabled(scheduleId, request.rowVersion(), true, jwt.getSubject()));
    }

    @PostMapping("/{scheduleId}/disable")
    public EtlScheduleResponse disable(
            @PathVariable @Positive long scheduleId,
            @Valid @RequestBody EtlScheduleVersionRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        return response(schedules.setEnabled(scheduleId, request.rowVersion(), false, jwt.getSubject()));
    }

    /** Soft delete: launches it fired keep pointing at it. */
    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<Void> delete(
            @PathVariable @Positive long scheduleId,
            @RequestParam @Positive Integer rowVersion,
            @AuthenticationPrincipal Jwt jwt) {
        schedules.delete(scheduleId, rowVersion, jwt.getSubject());
        return ResponseEntity.noContent().build();
    }

    private EtlScheduleResponse response(EtlSchedule schedule) {
        return EtlScheduleResponse.from(schedule, clock.instant());
    }
}
