package uatf.dss.authservice.application.port.in;

import java.util.List;
import java.util.UUID;

/**
 * Message published by the {@code uatf-webhook} Keycloak listener on {@code keycloak.user.events}.
 *
 * <p>Schema history (fields are only ever added, so older messages still parse):
 * <ul>
 *   <li>1 (no {@code schemaVersion}): USER_CREATED, USER_UPDATED, USER_ROLES_UPDATED with direct {@code roles}.</li>
 *   <li>2 (IAM-010): {@code effectiveRoles} on user snapshots, USER_DELETED and ROLE_CHANGED (with {@code role}).</li>
 * </ul>
 */
public record KeycloakUserEvent(
        Integer schemaVersion,
        String eventId,
        String realmId,
        String eventType,
        Long timestamp,
        UserSnapshot user,
        RoleChange role) {

    public static final String USER_CREATED = "USER_CREATED";
    public static final String USER_UPDATED = "USER_UPDATED";
    public static final String USER_ROLES_UPDATED = "USER_ROLES_UPDATED";
    public static final String USER_DELETED = "USER_DELETED";
    public static final String ROLE_CHANGED = "ROLE_CHANGED";

    /** Messages without {@code schemaVersion} were published before IAM-010. */
    public int effectiveSchemaVersion() {
        return schemaVersion == null ? 1 : schemaVersion;
    }

    public record UserSnapshot(
            UUID keycloakId,
            String username,
            String email,
            String firstName,
            String lastName,
            boolean isActive,
            List<RoleSnapshot> roles,
            List<RoleSnapshot> effectiveRoles) {
        public UserSnapshot {
            roles = roles == null ? null : List.copyOf(roles);
            effectiveRoles = effectiveRoles == null ? null : List.copyOf(effectiveRoles);
        }

        /** Effective roles when the publisher sent them (schema 2), otherwise the direct ones (schema 1). */
        public List<RoleSnapshot> rolesForSnapshot() {
            return effectiveRoles != null ? effectiveRoles : roles;
        }
    }

    public record RoleSnapshot(
            String id,
            String name,
            String description,
            boolean clientRole,
            String containerId) {}

    /**
     * A role whose holders may have different effective roles now.
     *
     * @param name              role name; {@code null} when Keycloak only gave the id of a role that no longer exists
     * @param clientId          public client id of a client role
     * @param change            COMPOSITES_ADDED, COMPOSITES_REMOVED, UPDATED (renamed) or DELETED
     * @param affectsRealmRoles {@code false} when only client roles (permissions) were added or removed; a missing
     *                          value is treated as {@code true}
     */
    public record RoleChange(
            String id,
            String name,
            boolean clientRole,
            String clientId,
            String change,
            Boolean affectsRealmRoles) {

        public boolean mayAffectRealmRoles() {
            return !Boolean.FALSE.equals(affectsRealmRoles);
        }
    }
}
