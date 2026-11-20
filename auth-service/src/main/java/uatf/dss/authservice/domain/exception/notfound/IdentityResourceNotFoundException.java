package uatf.dss.authservice.domain.exception.notfound;

/** A user, role or client does not exist in the identity provider. */
public class IdentityResourceNotFoundException extends NotFoundException {
    public IdentityResourceNotFoundException(String message) {
        super(message);
    }
}
