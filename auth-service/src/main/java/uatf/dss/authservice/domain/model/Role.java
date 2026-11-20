package uatf.dss.authservice.domain.model;

import uatf.dss.authservice.domain.exception.validation.InvalidRoleAssignmentException;

/**
 * A realm role as synced from Keycloak. Since IAM-004 role names are data, not an enum: Keycloak can define new
 * roles without a code change. {@link RoleType} only lists the institutional roles that carry academic-context rules.
 */
public record Role(
        Integer id,
        String name,
        String description
) {
    public Role{
        if (name == null || name.isBlank()) {
            throw new InvalidRoleAssignmentException("Role name cannot be empty.");
        }
    }
}
