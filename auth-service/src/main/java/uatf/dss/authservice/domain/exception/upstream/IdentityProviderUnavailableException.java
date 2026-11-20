package uatf.dss.authservice.domain.exception.upstream;

import uatf.dss.authservice.domain.exception.DomainException;

/** The identity provider could not be reached in time or is not configured. Maps to 503 Service Unavailable. */
public class IdentityProviderUnavailableException extends DomainException {
    public IdentityProviderUnavailableException(String message) {
        super(message);
    }

    @Override
    public int getHttpStatus() {
        return 503;
    }
}
