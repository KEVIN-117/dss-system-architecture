package uatf.dss.authservice.adapter.in.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import uatf.dss.authservice.application.port.in.AdminAuditPage;
import uatf.dss.authservice.application.port.in.ListAdminAuditQuery;
import uatf.dss.authservice.application.port.in.ListAdminAuditUseCase;
import uatf.dss.authservice.domain.model.audit.AuditOutcome;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;

import java.time.Instant;

@Validated
@RestController
@RequestMapping("/admin/iam/audit")
@Tag(name = "Administración")
@SecurityRequirement(name = "bearerAuth")
public class AdminAuditController {

    private final ListAdminAuditUseCase listAudit;

    public AdminAuditController(ListAdminAuditUseCase listAudit) {
        this.listAudit = listAudit;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('iam:audit:read')")
    @Operation(summary = "Consultar la auditoría de operaciones administrativas",
            description = "Paginada, de la más reciente a la más antigua. Requiere el permiso iam:audit:read.")
    public ResponseEntity<AdminAuditPage> list(
            @Parameter(description = "Keycloak id o username exacto de quien hizo la operación")
            @RequestParam(required = false) @Size(max = 255) String actor,
            @Parameter(description = "Acción exacta, por ejemplo USER_ACADEMIC_CONTEXTS_REPLACED")
            @RequestParam(required = false) @Size(max = 100) String action,
            @RequestParam(required = false) AuditTargetType targetType,
            @RequestParam(required = false) @Size(max = 255) String targetId,
            @RequestParam(required = false) AuditOutcome outcome,
            @Parameter(description = "Desde (incluido), ISO-8601, por ejemplo 2026-11-01T00:00:00Z")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @Parameter(description = "Hasta (excluido), ISO-8601")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        AdminAuditPage result = listAudit.execute(
                new ListAdminAuditQuery(actor, action, targetType, targetId, outcome, from, to, page, size));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result);
    }
}
