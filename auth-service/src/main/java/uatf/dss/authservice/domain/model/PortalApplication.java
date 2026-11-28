package uatf.dss.authservice.domain.model;

import java.util.Arrays;
import java.util.Optional;

/**
 * Applications a role can open (IAM-020/021). Each one has an access permission {@code portal:<id>} in the catalog
 * client; a role belongs to an application when it groups that permission, and it belongs to exactly one.
 */
public enum PortalApplication {

    ADMIN("admin"),
    RECTOR("rector"),
    DECANO("decano"),
    DIRECTOR("director");

    public static final String PERMISSION_PREFIX = "portal:";

    private final String id;

    PortalApplication(String id) {
        this.id = id;
    }

    /** Identifier used by the API, e.g. {@code rector}. */
    public String id() {
        return id;
    }

    /** Access permission in the catalog client, e.g. {@code portal:rector}. */
    public String permission() {
        return PERMISSION_PREFIX + id;
    }

    public static Optional<PortalApplication> fromId(String id) {
        return Arrays.stream(values()).filter(application -> application.id.equals(id)).findFirst();
    }

    public static Optional<PortalApplication> fromPermission(String permission) {
        return Arrays.stream(values()).filter(application -> application.permission().equals(permission)).findFirst();
    }

    /** Whether the permission is an application access permission ({@code portal:*}), known or not. */
    public static boolean isPortalPermission(String permission) {
        return permission != null && permission.startsWith(PERMISSION_PREFIX);
    }

    /** {@code admin, rector, decano, director}, for messages. */
    public static String ids() {
        return String.join(", ", Arrays.stream(values()).map(PortalApplication::id).toList());
    }

    /** The application of a system role: SUPERADMIN opens the admin portal, the academic roles their dashboard. */
    public static Optional<PortalApplication> ofSystemRole(String roleName) {
        return switch (roleName) {
            case "SUPERADMIN" -> Optional.of(ADMIN);
            case "RECTOR" -> Optional.of(RECTOR);
            case "DECANO" -> Optional.of(DECANO);
            case "DIRECTOR" -> Optional.of(DIRECTOR);
            case null, default -> Optional.empty();
        };
    }
}
