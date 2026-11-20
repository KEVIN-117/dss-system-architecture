package uatf.dss.authservice.domain.exception.validation;

/** The identity provider rejected the request data (400). */
public class IdentityRequestRejectedException extends ValidationException {
    public IdentityRequestRejectedException(String message) {
        super(message);
    }
}
