package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.User;
import java.util.Set;
import java.util.Optional;
import java.util.List;
import java.util.UUID;

public interface UserRepository {
    Optional<User> findByKeycloakId(UUID keycloakId);
    User save(User user);
    Optional<User> findById(UUID id);
    List<String> findRoleNamesByUserId(UUID id);
    void replaceRoleSnapshot(UUID userId, Set<String> roleNames);
    Optional<User> findByEmail(String email);
    void delete(UUID id);
    boolean existsByEmail(String email);
}
