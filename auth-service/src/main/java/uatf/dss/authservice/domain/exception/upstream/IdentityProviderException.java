package uatf.dss.authservice.domain.exception.upstream;

import uatf.dss.authservice.domain.exception.DomainException;

/**
 * The identity provider answered, but not in a way auth-service can use (unexpected status, insufficient
 * service-account privileges, rejected credentials). Maps to 502 Bad Gateway.
 */
public class IdentityProviderException extends DomainException {
    public IdentityProviderException(String message) {
        super(message);
    }

    @Override
    public int getHttpStatus() {
        return 502;
    }
}
