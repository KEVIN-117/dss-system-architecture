package uatf.dss.authservice.adapter.in.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uatf.dss.authservice.application.port.in.IamUserAdministrationUseCase;
import uatf.dss.authservice.application.port.in.IamUserCommands;
import uatf.dss.authservice.application.port.in.IamUserViews;
import uatf.dss.authservice.domain.model.identity.IdentityRequiredAction;

import java.net.URI;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;

/**
 * User administration in Keycloak from the admin portal (IAM-006). {@code {userId}} is the local user id exposed by
 * {@code /admin/users}. Every write is audited and requires {@code iam:users:write}; reads require
 * {@code iam:users:read}.
 */
@Validated
@RestController
@RequestMapping("/admin/iam/users")
@Tag(name = "Administración")
@SecurityRequirement(name = "bearerAuth")
public class IamUserController {

    private final IamUserAdministrationUseCase useCase;

    public IamUserController(IamUserAdministrationUseCase useCase) {
        this.useCase = useCase;
    }

    public record CreateUserRequest(
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9._@-]{3,255}$",
                    message = "username: 3 a 255 caracteres; letras, números, punto, guion, guion bajo o @")
            String username,
            @NotBlank @Email @Size(max = 255) String email,
            @Size(max = 255) String firstName,
            @Size(max = 255) String lastName,
            Boolean enabled,
            Boolean sendInvitation) {
    }

    public record UpdateUserRequest(
            @Email @Size(max = 255) String email,
            @Size(max = 255) String firstName,
            @Size(max = 255) String lastName,
            Boolean enabled) {
    }

    public record ActionsEmailRequest(
            @NotEmpty Set<@NotNull IdentityRequiredAction> actions,
            @Min(1) @Max(720) Integer lifespanHours) {
    }

    public record ReplaceRolesRequest(@NotNull Set<@NotBlank @Size(max = 255) String> roles) {
    }

    public record ReplacePermissionsRequest(@NotNull Set<@NotBlank @Size(max = 255) String> permissions) {
    }

    @PostMapping
    @PreAuthorize("hasAuthority('iam:users:write')")
    @Operation(summary = "Crear un usuario en Keycloak",
            description = "Crea el usuario sin contraseña y, salvo sendInvitation=false, le envía el correo para "
                    + "definir la contraseña y verificar el correo.")
    public ResponseEntity<IamUserViews.IamUser> create(@Valid @RequestBody CreateUserRequest request,
                                                       JwtAuthenticationToken authentication,
                                                       HttpServletRequest httpRequest) {
        IamUserViews.IamUser created = useCase.createUser(new IamUserCommands.CreateUser(
                AuditActors.from(authentication, httpRequest), request.username(), request.email(),
                request.firstName(), request.lastName(), !Boolean.FALSE.equals(request.enabled()),
                !Boolean.FALSE.equals(request.sendInvitation())));
        return ResponseEntity.created(URI.create("/admin/users/" + created.id())).body(created);
    }

    @PatchMapping("/{userId}")
    @PreAuthorize("hasAuthority('iam:users:write')")
    @Operation(summary = "Actualizar datos básicos o activar/desactivar un usuario")
    public ResponseEntity<IamUserViews.IamUser> update(@PathVariable UUID userId,
                                                       @Valid @RequestBody UpdateUserRequest request,
                                                       JwtAuthenticationToken authentication,
                                                       HttpServletRequest httpRequest) {
        return ResponseEntity.ok(useCase.updateUser(new IamUserCommands.UpdateUser(
                AuditActors.from(authentication, httpRequest), userId, request.email(), request.firstName(),
                request.lastName(), request.enabled())));
    }

    @PostMapping("/{userId}/actions-email")
    @PreAuthorize("hasAuthority('iam:users:write')")
    @Operation(summary = "Enviar acciones requeridas por correo",
            description = "Reenvía la invitación o pide restablecer la contraseña (UPDATE_PASSWORD).")
    public ResponseEntity<Void> sendActionsEmail(@PathVariable UUID userId,
                                                 @Valid @RequestBody ActionsEmailRequest request,
                                                 JwtAuthenticationToken authentication,
                                                 HttpServletRequest httpRequest) {
        useCase.sendActionsEmail(new IamUserCommands.SendActionsEmail(AuditActors.from(authentication, httpRequest),
                userId, request.actions(),
                request.lifespanHours() == null ? null : Duration.ofHours(request.lifespanHours())));
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }

    @GetMapping("/{userId}/roles")
    @PreAuthorize("hasAuthority('iam:users:read')")
    @Operation(summary = "Roles del realm del usuario (directos y efectivos)")
    public ResponseEntity<IamUserViews.IamAssignments> roles(@PathVariable UUID userId) {
        return ResponseEntity.ok(useCase.getRoles(userId));
    }

    @PutMapping("/{userId}/roles")
    @PreAuthorize("hasAuthority('iam:users:write')")
    @Operation(summary = "Reemplazar los roles del realm asignados directamente")
    public ResponseEntity<IamUserViews.IamAssignments> replaceRoles(@PathVariable UUID userId,
                                                                    @Valid @RequestBody ReplaceRolesRequest request,
                                                                    JwtAuthenticationToken authentication,
                                                                    HttpServletRequest httpRequest) {
        return ResponseEntity.ok(useCase.replaceRoles(new IamUserCommands.ReplaceRoles(
                AuditActors.from(authentication, httpRequest), userId, request.roles())));
    }

    @GetMapping("/{userId}/permissions")
    @PreAuthorize("hasAuthority('iam:users:read')")
    @Operation(summary = "Permisos del usuario (directos y heredados de sus roles)")
    public ResponseEntity<IamUserViews.IamAssignments> permissions(@PathVariable UUID userId) {
        return ResponseEntity.ok(useCase.getPermissions(userId));
    }

    @PutMapping("/{userId}/permissions")
    @PreAuthorize("hasAuthority('iam:users:write')")
    @Operation(summary = "Reemplazar los permisos asignados directamente al usuario")
    public ResponseEntity<IamUserViews.IamAssignments> replacePermissions(
            @PathVariable UUID userId,
            @Valid @RequestBody ReplacePermissionsRequest request,
            JwtAuthenticationToken authentication,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(useCase.replacePermissions(new IamUserCommands.ReplacePermissions(
                AuditActors.from(authentication, httpRequest), userId, request.permissions())));
    }
}
