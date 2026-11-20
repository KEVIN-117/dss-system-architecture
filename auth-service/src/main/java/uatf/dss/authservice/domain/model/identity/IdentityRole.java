package uatf.dss.authservice.domain.model.identity;

import java.util.List;
import java.util.Map;

/**
 * A realm role or a client role. In the DSS model realm roles group permissions, and client roles of
 * {@code dss-permissions} are permissions ({@code resource:action}).
 */
public record IdentityRole(
        String id,
        String name,
        String description,
        boolean composite,
        boolean clientRole,
        Map<String, List<String>> attributes) {

    public IdentityRole {
        attributes = attributes == null ? Map.of() : Map.copyOf(attributes);
    }
}
