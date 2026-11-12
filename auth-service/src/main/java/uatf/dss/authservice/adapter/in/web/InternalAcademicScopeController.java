package uatf.dss.authservice.adapter.in.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uatf.dss.authservice.application.port.in.GetUserAcademicScopeCommand;
import uatf.dss.authservice.application.port.in.GetUserAcademicScopeUseCase;
import uatf.dss.authservice.application.port.in.UserAcademicScope;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Service-to-service endpoint for the olap-service academic scope backstop
 * (docs/olap/academic-scope-backstop-design.md, §4.3). Not proxied by the BFF.
 *
 * <p>Two independent checks, both required:
 * <ol>
 *   <li>the token carries the {@code uatf-auth-service} client role {@code CONTEXT_READER}, which is
 *       granted only to service accounts in Keycloak; and
 *   <li>the token's authorized party ({@code azp}) is one of the configured reader clients, so a
 *       human user who was mistakenly given the role still cannot read other users' scope.
 * </ol>
 */
@RestController
@RequestMapping("/internal/users")
@Tag(name = "Interno")
@SecurityRequirement(name = "bearerAuth")
public class InternalAcademicScopeController {

    private final GetUserAcademicScopeUseCase useCase;
    private final Set<String> allowedClients;

    public InternalAcademicScopeController(
            GetUserAcademicScopeUseCase useCase,
            @Value("${app.security.context-reader.allowed-clients:olap-service}") List<String> allowedClients) {
        this.useCase = useCase;
        this.allowedClients = allowedClients.stream()
                .map(String::trim)
                .filter(client -> !client.isEmpty())
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    @GetMapping("/{keycloakId}/academic-contexts")
    @Operation(summary = "Alcance académico de un usuario (solo cuentas de servicio)")
    @PreAuthorize("hasAuthority('ROLE_CONTEXT_READER')")
    public ResponseEntity<UserAcademicScope> getAcademicScope(
            @PathVariable UUID keycloakId,
            JwtAuthenticationToken authentication) {
        String authorizedParty = authentication.getToken().getClaimAsString("azp");
        if (authorizedParty == null || !allowedClients.contains(authorizedParty)) {
            throw new AccessDeniedException("Client is not allowed to read academic scope");
        }
        UserAcademicScope scope = useCase.execute(new GetUserAcademicScopeCommand(keycloakId));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(scope);
    }
}
