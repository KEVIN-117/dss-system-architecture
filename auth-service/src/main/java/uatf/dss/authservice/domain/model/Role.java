package uatf.dss.authservice.domain.model;

import uatf.dss.authservice.domain.exception.validation.InvalidRoleAssignmentException;

public record Role(
        Integer id,
        RoleType name,
        String description
) {
    public Role{
        if (name == null || name.name().isBlank()) {
            throw new InvalidRoleAssignmentException("Role name cannot be empty.");
        }
    }
}
