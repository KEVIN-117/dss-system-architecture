package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.Role;

import java.util.Optional;
import java.util.UUID;

public interface AssignRoleRepository {
    void assignToUser(UUID userId, Integer roleId);
    void removeFromUser(UUID userId, Integer roleId);
}
