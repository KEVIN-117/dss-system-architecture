package uatf.dss.authservice.application.port.in;

import uatf.dss.authservice.domain.model.audit.AuditActor;

import java.util.Set;

/**
 * Commands of {@link IamRoleAdministrationUseCase}. Roles are realm roles; permissions are client roles of the
 * catalog client ({@code dss-permissions}) named {@code resource:action}. Names are immutable once created.
 */
public final class IamRoleCommands {

    private IamRoleCommands() {
    }

    public record CreateRole(AuditActor actor, String name, String description, String portal) {
    }

    /** {@code null} leaves a field unchanged; an empty {@code portal} removes it. */
    public record UpdateRole(AuditActor actor, String name, String description, String portal) {
    }

    /** {@code force} is required to delete a role that users still hold. */
    public record DeleteRole(AuditActor actor, String name, boolean force) {
    }

    public record ReplaceRolePermissions(AuditActor actor, String roleName, Set<String> permissions) {
        public ReplaceRolePermissions {
            permissions = Set.copyOf(permissions);
        }
    }

    public record CreatePermission(AuditActor actor, String name, String description) {
    }

    public record UpdatePermission(AuditActor actor, String name, String description) {
    }

    /** {@code force} is required to delete a permission that roles or users still hold. */
    public record DeletePermission(AuditActor actor, String name, boolean force) {
    }
}
