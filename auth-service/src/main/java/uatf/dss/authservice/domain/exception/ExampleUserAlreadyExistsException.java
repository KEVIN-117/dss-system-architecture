package uatf.dss.authservice.domain.exception;

import uatf.dss.authservice.domain.exception.conflict.ConflictException;

public class ExampleUserAlreadyExistsException extends ConflictException {
    public ExampleUserAlreadyExistsException(String email) {
        super("User already exists with email: " + email);
    }
}
