package uatf.dss.authservice.domain.model.identity;

/**
 * A user as the identity provider (Keycloak) stores it. {@code id} is the identity provider id
 * ({@code keycloak_id} in the local read model), not the local user id.
 */
public record IdentityUser(
        String id,
        String username,
        String email,
        String firstName,
        String lastName,
        boolean enabled,
        boolean emailVerified,
        Long createdTimestamp) {
}
