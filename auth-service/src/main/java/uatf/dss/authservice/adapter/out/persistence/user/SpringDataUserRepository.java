package uatf.dss.authservice.adapter.out.persistence.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uatf.dss.authservice.domain.model.User;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SpringDataUserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByKeycloakId(UUID keycloakId);

    boolean existsByEmail(String email);

    Optional<UserEntity> findByEmail(String email);

    @Query("select distinct role.name from UserEntity user join user.roles role where user.id = :userId")
    List<String> findRoleNamesByUserId(@Param("userId") UUID userId);
}
