package uatf.dss.authservice.adapter.in.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import uatf.dss.authservice.application.port.in.AdminUserDirectoryEntry;
import uatf.dss.authservice.application.port.in.AdminUserDirectoryPage;
import uatf.dss.authservice.application.port.in.GetAdminUserByIdUseCase;
import uatf.dss.authservice.application.port.in.ListAdminUsersQuery;
import uatf.dss.authservice.application.port.in.ListAdminUsersUseCase;

import java.util.UUID;

@Validated
@RestController
@RequestMapping("/admin/users")
@Tag(name = "Administración")
@SecurityRequirement(name = "bearerAuth")
public class AdminUserDirectoryController {

    private final ListAdminUsersUseCase listUsers;
    private final GetAdminUserByIdUseCase getUser;

    public AdminUserDirectoryController(ListAdminUsersUseCase listUsers, GetAdminUserByIdUseCase getUser) {
        this.listUsers = listUsers;
        this.getUser = getUser;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_SUPERADMIN')")
    @Operation(summary = "Listar usuarios para administración", description = "Directorio paginado y filtrable. Requiere el rol SUPERADMIN.")
    public ResponseEntity<AdminUserDirectoryPage> listUsers(
            @Parameter(description = "Búsqueda parcial por username, correo, nombre o apellido")
            @RequestParam(required = false) @Size(max = 120) String q,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) @Size(max = 50) String role,
            @RequestParam(required = false) @Min(0) Integer facultyId,
            @RequestParam(required = false) @Pattern(regexp = "[A-Za-z0-9]{3}") String careerId,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        AdminUserDirectoryPage result = listUsers.execute(new ListAdminUsersQuery(q, active, role, facultyId, careerId, page, size));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{userId}")
    @PreAuthorize("hasAuthority('ROLE_SUPERADMIN')")
    @Operation(summary = "Obtener el detalle administrativo de un usuario", description = "Identifica el usuario por su UUID local. No expone credenciales ni identificadores del proveedor de identidad.")
    public ResponseEntity<AdminUserDirectoryEntry> getUser(@PathVariable UUID userId) {
        return ResponseEntity.ok(getUser.execute(userId));
    }
}
