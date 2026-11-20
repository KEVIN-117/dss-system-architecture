package uatf.dss.authservice.adapter.out.persistence.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uatf.dss.authservice.domain.model.User;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SpringDataUserRepository extends JpaRepository<UserEntity, UUID>, JpaSpecificationExecutor<UserEntity> {
    Optional<UserEntity> findByKeycloakId(UUID keycloakId);

    boolean existsByEmail(String email);

    Optional<UserEntity> findByEmail(String email);

    @Query("select distinct role.name from UserEntity user join user.roles role where user.id = :userId")
    List<String> findRoleNamesByUserId(@Param("userId") UUID userId);

    @Query("select user.id, role.name from UserEntity user join user.roles role where user.id in :userIds")
    List<Object[]> findRoleNamesByUserIds(@Param("userIds") List<UUID> userIds);

    @Query("select distinct user.keycloakId from UserEntity user join user.roles role "
            + "where user.deletedAt is null and role.name in :roleNames")
    List<UUID> findLiveKeycloakIdsByRoleNames(@Param("roleNames") Collection<String> roleNames);

    @Query("select distinct role.name from UserEntity user join user.roles role where user.deletedAt is null")
    List<String> findRoleNamesOfLiveUsers();

    @Query("select user.keycloakId from UserEntity user where user.deletedAt is null")
    List<UUID> findLiveKeycloakIds();
}
