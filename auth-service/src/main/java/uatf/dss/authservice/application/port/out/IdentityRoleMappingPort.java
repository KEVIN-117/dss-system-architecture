package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.identity.IdentityRole;

import java.util.List;
import java.util.Set;

/** Assigns realm and client roles to users. {@code effective == true} expands composites. */
public interface IdentityRoleMappingPort {

    List<IdentityRole> listUserRealmRoles(String userId, boolean effective);

    void addUserRealmRoles(String userId, Set<String> roleNames);

    void removeUserRealmRoles(String userId, Set<String> roleNames);

    List<IdentityRole> listUserClientRoles(String userId, String clientId, boolean effective);

    void addUserClientRoles(String userId, String clientId, Set<String> roleNames);

    void removeUserClientRoles(String userId, String clientId, Set<String> roleNames);
}
