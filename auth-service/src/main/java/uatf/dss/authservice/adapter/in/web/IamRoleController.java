package uatf.dss.authservice.adapter.in.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import uatf.dss.authservice.application.port.in.IamRoleAdministrationUseCase;
import uatf.dss.authservice.application.port.in.IamRoleCommands;
import uatf.dss.authservice.application.port.in.IamRoleViews;

import java.net.URI;
import java.util.List;
import java.util.Set;

/** Realm roles and the permissions each one groups (IAM-007). Reads need {@code iam:roles:read}, writes {@code iam:roles:write}. */
@Validated
@RestController
@RequestMapping("/admin/iam/roles")
@Tag(name = "Administración")
@SecurityRequirement(name = "bearerAuth")
public class IamRoleController {

    private final IamRoleAdministrationUseCase useCase;

    public IamRoleController(IamRoleAdministrationUseCase useCase) {
        this.useCase = useCase;
    }

    public record CreateRoleRequest(
            @NotBlank @Size(max = 50) String name,
            @Size(max = 255) String description,
            @Size(max = 50) String portal) {
    }

    public record UpdateRoleRequest(@Size(max = 255) String description, @Size(max = 50) String portal) {
    }

    public record ReplacePermissionsRequest(@NotNull Set<@NotBlank @Size(max = 100) String> permissions) {
    }

    @GetMapping
    @PreAuthorize("hasAuthority('iam:roles:read')")
    @Operation(summary = "Listar los roles del realm", description = "No incluye los roles integrados de Keycloak.")
    public ResponseEntity<List<IamRoleViews.Role>> list() {
        return ResponseEntity.ok(useCase.listRoles());
    }

    @GetMapping("/{name}")
    @PreAuthorize("hasAuthority('iam:roles:read')")
    @Operation(summary = "Obtener un rol")
    public ResponseEntity<IamRoleViews.Role> get(@PathVariable String name) {
        return ResponseEntity.ok(useCase.getRole(name));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('iam:roles:write')")
    @Operation(summary = "Crear un rol del realm",
            description = "portal (obligatorio) es la aplicación que abre el rol: admin, rector, decano o director. "
                    + "El rol agrupa su permiso portal:<aplicación>.")
    public ResponseEntity<IamRoleViews.Role> create(@Valid @RequestBody CreateRoleRequest request,
                                                    JwtAuthenticationToken authentication,
                                                    HttpServletRequest httpRequest) {
        IamRoleViews.Role created = useCase.createRole(new IamRoleCommands.CreateRole(
                AuditActors.from(authentication, httpRequest), request.name(), request.description(), request.portal()));
        return ResponseEntity.created(URI.create("/admin/iam/roles/" + created.name())).body(created);
    }

    @PatchMapping("/{name}")
    @PreAuthorize("hasAuthority('iam:roles:write')")
    @Operation(summary = "Actualizar la descripción o la aplicación de un rol",
            description = "El nombre no cambia. Cambiar portal reemplaza el permiso portal:* del rol; un rol no puede "
                    + "quedar sin aplicación y los roles del sistema conservan la suya.")
    public ResponseEntity<IamRoleViews.Role> update(@PathVariable String name,
                                                    @Valid @RequestBody UpdateRoleRequest request,
                                                    JwtAuthenticationToken authentication,
                                                    HttpServletRequest httpRequest) {
        return ResponseEntity.ok(useCase.updateRole(new IamRoleCommands.UpdateRole(
                AuditActors.from(authentication, httpRequest), name, request.description(), request.portal())));
    }

    @DeleteMapping("/{name}")
    @PreAuthorize("hasAuthority('iam:roles:write')")
    @Operation(summary = "Eliminar un rol",
            description = "Los roles del sistema no se eliminan. Un rol con usuarios requiere force=true.")
    public ResponseEntity<Void> delete(@PathVariable String name,
                                       @RequestParam(defaultValue = "false") boolean force,
                                       JwtAuthenticationToken authentication,
                                       HttpServletRequest httpRequest) {
        useCase.deleteRole(new IamRoleCommands.DeleteRole(AuditActors.from(authentication, httpRequest), name, force));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{name}/permissions")
    @PreAuthorize("hasAuthority('iam:roles:read')")
    @Operation(summary = "Permisos que agrupa el rol")
    public ResponseEntity<List<IamRoleViews.Permission>> permissions(@PathVariable String name) {
        return ResponseEntity.ok(useCase.getRolePermissions(name));
    }

    @PutMapping("/{name}/permissions")
    @PreAuthorize("hasAuthority('iam:roles:write')")
    @Operation(summary = "Reemplazar los permisos que agrupa el rol",
            description = "Los usuarios con el rol reciben el cambio en su próximo token. La aplicación (portal:*) no "
                    + "cambia aquí: se conserva aunque falte en la lista y agregar otra devuelve 400.")
    public ResponseEntity<List<IamRoleViews.Permission>> replacePermissions(
            @PathVariable String name,
            @Valid @RequestBody ReplacePermissionsRequest request,
            JwtAuthenticationToken authentication,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(useCase.replaceRolePermissions(new IamRoleCommands.ReplaceRolePermissions(
                AuditActors.from(authentication, httpRequest), name, request.permissions())));
    }
}
