package uatf.dss.authservice.domain.exception.conflict;

import uatf.dss.authservice.domain.exception.DomainException;

public class ConflictException extends DomainException {
    public ConflictException(String message) {
        super(message);
    }

    @Override
    public int getHttpStatus() {
        return 409;
    }
}
