package uatf.dss.authservice.application.port.in;

import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.identity.IdentityRequiredAction;

import java.time.Duration;
import java.util.Set;
import java.util.UUID;

/**
 * Commands of {@link IamUserAdministrationUseCase}. {@code userId} is always the local user id (the one the user
 * directory exposes), never the identity provider id. {@code actor} identifies who acts, for the audit log.
 */
public final class IamUserCommands {

    private IamUserCommands() {
    }

    public record CreateUser(
            AuditActor actor,
            String username,
            String email,
            String firstName,
            String lastName,
            boolean enabled,
            boolean sendInvitation) {
    }

    /** A {@code null} field is left unchanged. */
    public record UpdateUser(
            AuditActor actor,
            UUID userId,
            String email,
            String firstName,
            String lastName,
            Boolean enabled) {
    }

    public record SendActionsEmail(
            AuditActor actor,
            UUID userId,
            Set<IdentityRequiredAction> actions,
            Duration lifespan) {

        public SendActionsEmail {
            actions = Set.copyOf(actions);
        }
    }

    /** Replaces the user's direct realm roles; Keycloak's built-in roles are never touched. */
    public record ReplaceRoles(AuditActor actor, UUID userId, Set<String> roles) {
        public ReplaceRoles {
            roles = Set.copyOf(roles);
        }
    }

    /** Replaces the permissions assigned directly to the user (not those inherited from roles). */
    public record ReplacePermissions(AuditActor actor, UUID userId, Set<String> permissions) {
        public ReplacePermissions {
            permissions = Set.copyOf(permissions);
        }
    }
}
