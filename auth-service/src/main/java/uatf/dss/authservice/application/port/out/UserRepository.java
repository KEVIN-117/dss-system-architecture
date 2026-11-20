package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.application.port.out.UserDirectorySearchResult;
import java.util.Set;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
import java.util.Collection;
import java.util.Map;

public interface UserRepository {
    Optional<User> findByKeycloakId(UUID keycloakId);
    User save(User user);
    Optional<User> findById(UUID id);
    List<String> findRoleNamesByUserId(UUID id);
    Map<UUID, List<String>> findRoleNamesByUserIds(Collection<UUID> ids);
    void replaceRoleSnapshot(UUID userId, Set<String> roleNames);
    Optional<User> findByEmail(String email);
    void delete(UUID id);
    boolean existsByEmail(String email);
    /**
     * Logical deletion of a user that no longer exists in Keycloak (IAM-010): deactivates it, replaces username and
     * e-mail with tombstone values (so a new account may reuse them), clears names, roles and academic contexts and
     * stamps {@code deleted_at}. Returns {@code false} if there is no live local user with that id.
     */
    boolean markDeleted(UUID keycloakId, java.time.Instant deletedAt);
    /** Keycloak ids of live (not deleted) local users holding any of the roles. */
    List<UUID> findKeycloakIdsByRoleNames(Collection<String> roleNames);
    /** Distinct role names held by live local users. */
    Set<String> findAssignedRoleNames();
    /** Keycloak ids of every live local user. */
    Set<UUID> findLiveKeycloakIds();
    UserDirectorySearchResult searchDirectory(String query, Boolean active, String role, Integer facultyId, String careerId, int page, int size);
}
