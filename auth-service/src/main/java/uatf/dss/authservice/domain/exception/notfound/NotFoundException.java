package uatf.dss.authservice.domain.exception.notfound;

import uatf.dss.authservice.domain.exception.DomainException;

public class NotFoundException extends DomainException {
    public NotFoundException(String message) {
        super(message);
    }

    @Override
    public int getHttpStatus() {
        return 404;
    }
}
