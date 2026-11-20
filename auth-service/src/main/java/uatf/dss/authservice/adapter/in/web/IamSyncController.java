package uatf.dss.authservice.adapter.in.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uatf.dss.authservice.application.port.in.IdentitySyncUseCase;

/** Full resynchronization of the local user copy from Keycloak, to recover from lost or failed events (IAM-010). */
@RestController
@RequestMapping("/admin/iam/users/resync")
@Tag(name = "Administración")
@SecurityRequirement(name = "bearerAuth")
public class IamSyncController {

    private final IdentitySyncUseCase useCase;

    public IamSyncController(IdentitySyncUseCase useCase) {
        this.useCase = useCase;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('iam:users:write')")
    @Operation(summary = "Resincronizar todos los usuarios desde Keycloak",
            description = "Relee cada usuario de Keycloak con sus roles efectivos y borra lógicamente los que ya no "
                    + "existen allí. Es síncrono; queda auditado como USERS_RESYNCED.")
    public ResponseEntity<IdentitySyncUseCase.ResyncReport> resync(JwtAuthenticationToken authentication,
                                                                    HttpServletRequest httpRequest) {
        return ResponseEntity.ok(useCase.resyncAll(AuditActors.from(authentication, httpRequest)));
    }
}
