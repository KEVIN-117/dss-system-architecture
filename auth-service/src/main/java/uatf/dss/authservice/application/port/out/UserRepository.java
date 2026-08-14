package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.exception.DuplicateEmailException;
import uatf.dss.authservice.domain.exception.DuplicateKeycloakIdException;
import uatf.dss.authservice.domain.exception.InvalidEmailException;
import uatf.dss.authservice.domain.exception.UserNotFoundException;
import uatf.dss.authservice.domain.model.User;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository {
    Optional<User> findByKeycloakId(UUID keycloakId);
    User save(User user);
    Optional<User> findById(UUID id);
    Optional<User> findByEmail(String email);
    Optional<User> delete(UUID id);
    boolean existsByEmail(String email);
}
