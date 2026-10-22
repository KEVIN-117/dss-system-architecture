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
    UserDirectorySearchResult searchDirectory(String query, Boolean active, String role, Integer facultyId, String careerId, int page, int size);
}
