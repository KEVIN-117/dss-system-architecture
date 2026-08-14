package uatf.dss.authservice.domain.exception.forbidden;

import uatf.dss.authservice.domain.exception.DomainException;

public class ForbiddenException extends DomainException {
    public ForbiddenException(String message) {
        super(message);
    }

    @Override
    public int getHttpStatus() {
        return 403;
    }
}
