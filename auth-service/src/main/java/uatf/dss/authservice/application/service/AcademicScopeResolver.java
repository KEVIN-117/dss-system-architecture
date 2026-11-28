package uatf.dss.authservice.application.service;

import uatf.dss.authservice.application.port.out.IdentityRoleMappingPort;
import uatf.dss.authservice.domain.model.AcademicScope;
import uatf.dss.authservice.domain.model.identity.IdentityRole;

import java.util.List;

/**
 * Computes a user's {@link AcademicScope} live from Keycloak: the effective (composite-expanded) client roles of the
 * permissions client. The local role snapshot is never the authority for this.
 */
public class AcademicScopeResolver {

    private final IdentityRoleMappingPort mappings;
    private final String permissionsClientId;

    public AcademicScopeResolver(IdentityRoleMappingPort mappings, String permissionsClientId) {
        this.mappings = mappings;
        this.permissionsClientId = permissionsClientId;
    }

    public AcademicScope resolve(String keycloakUserId) {
        List<String> permissions = mappings.listUserClientRoles(keycloakUserId, permissionsClientId, true).stream()
                .map(IdentityRole::name)
                .toList();
        return AcademicScope.fromPermissions(permissions);
    }
}
