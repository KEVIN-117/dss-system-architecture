package uatf.dss.authservice.adapter.in.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import uatf.dss.authservice.application.port.in.IamRoleAdministrationUseCase;
import uatf.dss.authservice.application.port.in.IamRoleCommands;
import uatf.dss.authservice.application.port.in.IamRoleViews;

import java.net.URI;
import java.util.List;

/**
 * The permission catalog ({@code dss-permissions} client roles, {@code resource:action}) and the role × permission
 * matrix (IAM-007). Reads need {@code iam:roles:read}, writes {@code iam:roles:write}.
 */
@Validated
@RestController
@RequestMapping("/admin/iam/permissions")
@Tag(name = "Administración")
@SecurityRequirement(name = "bearerAuth")
public class IamPermissionController {

    private final IamRoleAdministrationUseCase useCase;

    public IamPermissionController(IamRoleAdministrationUseCase useCase) {
        this.useCase = useCase;
    }

    public record CreatePermissionRequest(@NotBlank @Size(max = 100) String name,
                                          @NotBlank @Size(max = 255) String description) {
    }

    public record UpdatePermissionRequest(@NotBlank @Size(max = 255) String description) {
    }

    @GetMapping
    @PreAuthorize("hasAuthority('iam:roles:read')")
    @Operation(summary = "Listar el catálogo de permisos")
    public ResponseEntity<List<IamRoleViews.Permission>> list() {
        return ResponseEntity.ok(useCase.listPermissions());
    }

    @GetMapping("/matrix")
    @PreAuthorize("hasAuthority('iam:roles:read')")
    @Operation(summary = "Matriz rol × permiso")
    public ResponseEntity<IamRoleViews.Matrix> matrix() {
        return ResponseEntity.ok(useCase.matrix());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('iam:roles:write')")
    @Operation(summary = "Crear un permiso", description = "Nombre recurso:acción en minúsculas, por ejemplo reports:export.")
    public ResponseEntity<IamRoleViews.Permission> create(@Valid @RequestBody CreatePermissionRequest request,
                                                          JwtAuthenticationToken authentication,
                                                          HttpServletRequest httpRequest) {
        IamRoleViews.Permission created = useCase.createPermission(new IamRoleCommands.CreatePermission(
                AuditActors.from(authentication, httpRequest), request.name(), request.description()));
        return ResponseEntity.created(URI.create("/admin/iam/permissions/" + created.name())).body(created);
    }

    @PatchMapping("/{name}")
    @PreAuthorize("hasAuthority('iam:roles:write')")
    @Operation(summary = "Actualizar la descripción de un permiso", description = "El nombre no cambia.")
    public ResponseEntity<IamRoleViews.Permission> update(@PathVariable String name,
                                                          @Valid @RequestBody UpdatePermissionRequest request,
                                                          JwtAuthenticationToken authentication,
                                                          HttpServletRequest httpRequest) {
        return ResponseEntity.ok(useCase.updatePermission(new IamRoleCommands.UpdatePermission(
                AuditActors.from(authentication, httpRequest), name, request.description())));
    }

    @DeleteMapping("/{name}")
    @PreAuthorize("hasAuthority('iam:roles:write')")
    @Operation(summary = "Eliminar un permiso",
            description = "Los permisos del sistema no se eliminan. Uno en uso por roles o usuarios requiere force=true.")
    public ResponseEntity<Void> delete(@PathVariable String name,
                                       @RequestParam(defaultValue = "false") boolean force,
                                       JwtAuthenticationToken authentication,
                                       HttpServletRequest httpRequest) {
        useCase.deletePermission(new IamRoleCommands.DeletePermission(
                AuditActors.from(authentication, httpRequest), name, force));
        return ResponseEntity.noContent().build();
    }
}
