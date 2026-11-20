package uatf.dss.authservice.domain.model;

import java.util.Locale;
import java.util.Set;

/**
 * Realm roles Keycloak gives every user ({@code offline_access}, {@code uma_authorization},
 * {@code default-roles-<realm>}). They say nothing about a user's institutional role, so they are neither synced
 * nor shown or assigned through the administration API.
 */
public final class KeycloakBuiltInRoles {

    private static final Set<String> BUILT_IN = Set.of("offline_access", "uma_authorization");
    private static final String DEFAULT_ROLES_PREFIX = "default-roles-";

    private KeycloakBuiltInRoles() {
    }

    public static boolean isBuiltIn(String roleName) {
        if (roleName == null) {
            return false;
        }
        String normalized = roleName.trim().toLowerCase(Locale.ROOT);
        return BUILT_IN.contains(normalized) || normalized.startsWith(DEFAULT_ROLES_PREFIX);
    }
}
