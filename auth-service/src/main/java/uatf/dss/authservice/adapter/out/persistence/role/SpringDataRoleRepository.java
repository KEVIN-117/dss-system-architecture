package uatf.dss.authservice.adapter.out.persistence.role;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.Collection;
import java.util.List;

public interface SpringDataRoleRepository extends JpaRepository<RoleEntity, Integer> {
    Optional<RoleEntity> findByName(String name);
    List<RoleEntity> findAllByNameIn(Collection<String> names);

    /** Registers a role seen in Keycloak for the first time; a concurrent insert of the same name is a no-op. */
    @Modifying
    @Query(value = "INSERT INTO roles (name) VALUES (:name) ON CONFLICT (name) DO NOTHING", nativeQuery = true)
    void insertIfAbsent(@Param("name") String name);
}
