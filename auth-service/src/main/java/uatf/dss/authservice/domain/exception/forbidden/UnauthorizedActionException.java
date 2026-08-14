package uatf.dss.authservice.domain.exception.forbidden;

import uatf.dss.authservice.domain.exception.DomainException;

public class UnauthorizedActionException extends ForbiddenException {
    public UnauthorizedActionException() {
        super("You are not authorized to perform this action.");
    }

    public UnauthorizedActionException(String message) {
        super(message);
    }
}
