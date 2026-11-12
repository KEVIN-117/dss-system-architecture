package uatf.dss.authservice.application.port.in;

import java.util.List;
import java.util.UUID;

/**
 * Service-to-service view of what a user may see in analytics: the DSS role snapshot and the
 * academic contexts assigned in auth-service. Consumed by olap-service to pick Mondrian roles.
 *
 * <p>Deliberately carries no personal data (no username, email or names) and no internal ids.
 *
 * @param keycloakId the Keycloak subject the scope belongs to
 * @param active     whether the user is active; consumers must deny inactive users
 * @param roles      role snapshot, upper-case without the {@code ROLE_} prefix, sorted, de-duplicated
 * @param contexts   assigned academic contexts (empty for RECTOR/SUPERADMIN)
 */
public record UserAcademicScope(
        UUID keycloakId,
        boolean active,
        List<String> roles,
        List<Context> contexts
) {
    public UserAcademicScope {
        roles = List.copyOf(roles);
        contexts = List.copyOf(contexts);
    }

    /** One academic context: a faculty, optionally narrowed to one career of that faculty. */
    public record Context(Integer facultyId, String careerId) {}
}
