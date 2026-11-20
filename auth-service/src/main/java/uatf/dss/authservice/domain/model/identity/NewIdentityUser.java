package uatf.dss.authservice.domain.model.identity;

/** Data to create a user in the identity provider. Credentials are never set here: users set them via required actions. */
public record NewIdentityUser(
        String username,
        String email,
        String firstName,
        String lastName,
        boolean enabled,
        boolean emailVerified) {
}
