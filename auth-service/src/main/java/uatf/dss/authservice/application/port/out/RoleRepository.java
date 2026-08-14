package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.exception.RoleAlreadyAssignedException;
import uatf.dss.authservice.domain.exception.RoleAssignmentException;
import uatf.dss.authservice.domain.exception.RoleNotFoundException;
import uatf.dss.authservice.domain.model.Role;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoleRepository {
    Optional<Role> findByName(String name);
    List<Role> listAll();
}
