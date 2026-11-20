package uatf.dss.authservice.domain.model.identity;

/** Keycloak required actions that can be sent to a user by e-mail. */
public enum IdentityRequiredAction {
    UPDATE_PASSWORD,
    VERIFY_EMAIL,
    UPDATE_PROFILE,
    CONFIGURE_TOTP
}
