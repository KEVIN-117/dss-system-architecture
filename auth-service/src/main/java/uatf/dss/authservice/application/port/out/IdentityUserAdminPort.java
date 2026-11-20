package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.identity.IdentityRequiredAction;
import uatf.dss.authservice.domain.model.identity.IdentityUser;
import uatf.dss.authservice.domain.model.identity.IdentityUserChanges;
import uatf.dss.authservice.domain.model.identity.NewIdentityUser;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Manages users in the identity provider (Keycloak Admin REST API). Ids are identity provider ids. */
public interface IdentityUserAdminPort {

    /** Searches by username, e-mail, first or last name. {@code search == null} lists everyone. */
    List<IdentityUser> searchUsers(String search, int first, int max);

    long countUsers(String search);

    Optional<IdentityUser> findUserById(String userId);

    Optional<IdentityUser> findUserByUsername(String username);

    /** @return the id of the new user */
    String createUser(NewIdentityUser user);

    void updateUser(String userId, IdentityUserChanges changes);

    void deleteUser(String userId);

    /** Sends the user an e-mail to complete the given actions (set password, verify e-mail, ...). */
    void sendRequiredActionsEmail(String userId, Set<IdentityRequiredAction> actions, Duration lifespan);
}
