package uatf.dss.authservice.domain.model.identity;

/** Partial update of a user. A {@code null} field means "leave unchanged". */
public record IdentityUserChanges(
        String email,
        String firstName,
        String lastName,
        Boolean enabled,
        Boolean emailVerified) {
}
