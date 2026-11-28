package uatf.dss.authservice.application.port.in;

import java.util.List;
import java.util.Map;

/** Responses of {@link IamRoleAdministrationUseCase}. */
public final class IamRoleViews {

    private IamRoleViews() {
    }

    /**
     * @param portal application the role opens ({@code admin}, {@code rector}, {@code decano} or {@code director}),
     *               taken from the {@code portal:*} permission it groups; {@code null} if it has none yet
     * @param system role the platform depends on: it can be edited but not deleted
     */
    public record Role(String name, String description, String portal, boolean system) {
    }

    /**
     * @param resource everything before the last {@code :} (e.g. {@code dw:closure})
     * @param action   the part after the last {@code :} (e.g. {@code manage})
     * @param system   permission the platform depends on: it can be edited but not deleted
     */
    public record Permission(String name, String description, String resource, String action, boolean system) {
    }

    /** Role × permission grid: {@code grants} maps each role to the permissions it groups. */
    public record Matrix(List<Role> roles, List<Permission> permissions, Map<String, List<String>> grants) {
    }
}
