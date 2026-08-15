package uatf.dss.authservice.adapter.out.persistence.user;

import org.springframework.data.jpa.repository.JpaRepository;
import uatf.dss.authservice.domain.model.User;

import java.util.Optional;
import java.util.UUID;

public interface SpringDataUserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByKeycloakId(UUID keycloakId);

    boolean existsByEmail(String email);

    Optional<UserEntity> findByEmail(String email);
}
