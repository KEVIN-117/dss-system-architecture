package uatf.dss.authservice.domain.exception.validation;

import uatf.dss.authservice.domain.exception.DomainException;

public class ValidationException extends DomainException {
    public ValidationException(String message){
        super(message);
    }
    @Override
    public int getHttpStatus() {
        return 400;
    }
}
