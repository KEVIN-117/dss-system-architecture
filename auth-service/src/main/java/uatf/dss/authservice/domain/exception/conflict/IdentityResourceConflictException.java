package uatf.dss.authservice.domain.exception.conflict;

/** The identity provider rejected a change because it conflicts with existing data (duplicate username, role, client...). */
public class IdentityResourceConflictException extends ConflictException {
    public IdentityResourceConflictException(String message) {
        super(message);
    }
}
