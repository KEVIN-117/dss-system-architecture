package uatf.dss.authservice.adapter.in.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import uatf.dss.authservice.application.port.in.IamClientAdministrationUseCase;
import uatf.dss.authservice.application.port.in.IamClientCommands;
import uatf.dss.authservice.application.port.in.IamClientViews;

import java.net.URI;
import java.util.List;

/**
 * Applications (OAuth clients) of the realm (IAM-008). Reads need {@code iam:clients:read}, writes
 * {@code iam:clients:write}. Responses that carry a secret are never cached.
 */
@Validated
@RestController
@RequestMapping("/admin/iam/clients")
@Tag(name = "Administración")
@SecurityRequirement(name = "bearerAuth")
public class IamClientController {

    private final IamClientAdministrationUseCase useCase;

    public IamClientController(IamClientAdministrationUseCase useCase) {
        this.useCase = useCase;
    }

    public record CreateClientRequest(
            @NotBlank @Size(max = 64) String clientId,
            @Size(max = 255) String name,
            @Size(max = 255) String description,
            @NotNull IamClientCommands.ClientType type,
            Boolean enabled,
            Boolean serviceAccountsEnabled,
            @Size(max = 50) List<@NotBlank @Size(max = 500) String> redirectUris,
            @Size(max = 50) List<@NotBlank @Size(max = 500) String> webOrigins,
            @Size(max = 50) List<@NotBlank @Size(max = 500) String> postLogoutRedirectUris) {
    }

    public record UpdateClientRequest(
            @Size(max = 255) String name,
            @Size(max = 255) String description,
            Boolean enabled,
            @Size(max = 50) List<@NotBlank @Size(max = 500) String> redirectUris,
            @Size(max = 50) List<@NotBlank @Size(max = 500) String> webOrigins,
            @Size(max = 50) List<@NotBlank @Size(max = 500) String> postLogoutRedirectUris) {
    }

    @GetMapping
    @PreAuthorize("hasAuthority('iam:clients:read')")
    @Operation(summary = "Listar las aplicaciones registradas",
            description = "search filtra por clientId (contiene, sin distinguir mayúsculas).")
    public ResponseEntity<List<IamClientViews.Client>> list(
            @RequestParam(required = false) @Size(max = 64) String search,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int size) {
        return ResponseEntity.ok(useCase.listClients(search, page, size));
    }

    @GetMapping("/{clientId}")
    @PreAuthorize("hasAuthority('iam:clients:read')")
    @Operation(summary = "Obtener una aplicación")
    public ResponseEntity<IamClientViews.Client> get(@PathVariable String clientId) {
        return ResponseEntity.ok(useCase.getClient(clientId));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('iam:clients:write')")
    @Operation(summary = "Registrar una aplicación",
            description = "Un cliente CONFIDENTIAL recibe su primer secreto en esta respuesta; no se vuelve a mostrar.")
    public ResponseEntity<IamClientViews.CreatedClient> create(@Valid @RequestBody CreateClientRequest request,
                                                               JwtAuthenticationToken authentication,
                                                               HttpServletRequest httpRequest) {
        IamClientViews.CreatedClient created = useCase.createClient(new IamClientCommands.CreateClient(
                AuditActors.from(authentication, httpRequest), request.clientId(), request.name(),
                request.description(), request.type(), !Boolean.FALSE.equals(request.enabled()),
                Boolean.TRUE.equals(request.serviceAccountsEnabled()), request.redirectUris(), request.webOrigins(),
                request.postLogoutRedirectUris()));
        return ResponseEntity.created(URI.create("/admin/iam/clients/" + created.client().clientId()))
                .cacheControl(CacheControl.noStore())
                .body(created);
    }

    @PatchMapping("/{clientId}")
    @PreAuthorize("hasAuthority('iam:clients:write')")
    @Operation(summary = "Actualizar una aplicación",
            description = "Los clientes del sistema son de solo lectura, salvo nombre, descripción y URIs de dss-bff.")
    public ResponseEntity<IamClientViews.Client> update(@PathVariable String clientId,
                                                        @Valid @RequestBody UpdateClientRequest request,
                                                        JwtAuthenticationToken authentication,
                                                        HttpServletRequest httpRequest) {
        return ResponseEntity.ok(useCase.updateClient(new IamClientCommands.UpdateClient(
                AuditActors.from(authentication, httpRequest), clientId, request.name(), request.description(),
                request.enabled(), request.redirectUris(), request.webOrigins(), request.postLogoutRedirectUris())));
    }

    @PostMapping("/{clientId}/secret")
    @PreAuthorize("hasAuthority('iam:clients:write')")
    @Operation(summary = "Rotar el secreto de una aplicación confidencial",
            description = "Devuelve el nuevo secreto una sola vez. El anterior deja de valer de inmediato.")
    public ResponseEntity<IamClientViews.IssuedSecret> rotateSecret(@PathVariable String clientId,
                                                                    JwtAuthenticationToken authentication,
                                                                    HttpServletRequest httpRequest) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(useCase.rotateSecret(new IamClientCommands.RotateSecret(
                        AuditActors.from(authentication, httpRequest), clientId)));
    }
}
