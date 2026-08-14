package uatf.dss.authservice.domain.exception.forbidden;

import uatf.dss.authservice.domain.exception.DomainException;

public class UserInactiveException extends ForbiddenException {
    public UserInactiveException() {
        super("This account is inactive and cannot be used.");
    }

    public UserInactiveException(String message) {
        super(message);
    }
}
