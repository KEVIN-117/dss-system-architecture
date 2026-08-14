package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.Role;

import java.util.List;
import java.util.Optional;

public interface RoleRepository {
    Optional<Role> findByName(String name);
    List<Role> listAll();
}
