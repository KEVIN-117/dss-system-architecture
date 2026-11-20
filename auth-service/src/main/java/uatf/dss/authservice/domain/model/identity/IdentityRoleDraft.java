package uatf.dss.authservice.domain.model.identity;

import java.util.List;
import java.util.Map;

/** Data to create or update a role. {@code attributes == null} leaves the stored attributes unchanged on update. */
public record IdentityRoleDraft(
        String name,
        String description,
        Map<String, List<String>> attributes) {
}
