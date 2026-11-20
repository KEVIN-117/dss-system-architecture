package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.identity.IdentityRoleDraft;
import uatf.dss.authservice.domain.model.identity.IdentityUser;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Manages realm roles, client roles and realm-role composites in the identity provider.
 * {@code clientId} is always the public client id (for example {@code dss-permissions}), never the internal id.
 */
public interface IdentityRoleAdminPort {

    List<IdentityRole> listRealmRoles();

    Optional<IdentityRole> findRealmRole(String roleName);

    void createRealmRole(IdentityRoleDraft role);

    void updateRealmRole(String roleName, IdentityRoleDraft role);

    void deleteRealmRole(String roleName);

    List<IdentityRole> listClientRoles(String clientId);

    Optional<IdentityRole> findClientRole(String clientId, String roleName);

    void createClientRole(String clientId, IdentityRoleDraft role);

    void updateClientRole(String clientId, String roleName, IdentityRoleDraft role);

    void deleteClientRole(String clientId, String roleName);

    /** Client roles of {@code clientId} directly included in the realm role. */
    List<IdentityRole> listRealmRoleClientComposites(String realmRoleName, String clientId);

    void addClientCompositesToRealmRole(String realmRoleName, String clientId, Set<String> clientRoleNames);

    void removeClientCompositesFromRealmRole(String realmRoleName, String clientId, Set<String> clientRoleNames);

    /** Users that hold the realm role directly. */
    List<IdentityUser> listUsersWithRealmRole(String roleName, int first, int max);

    /** Users that hold the client role directly. */
    List<IdentityUser> listUsersWithClientRole(String clientId, String roleName, int first, int max);
}
