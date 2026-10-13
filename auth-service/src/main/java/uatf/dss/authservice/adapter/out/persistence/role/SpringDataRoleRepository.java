package uatf.dss.authservice.adapter.out.persistence.role;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.Collection;
import java.util.List;

public interface SpringDataRoleRepository extends JpaRepository<RoleEntity, Integer> {
    Optional<RoleEntity> findByName(String name);
    List<RoleEntity> findAllByNameIn(Collection<String> names);
}
