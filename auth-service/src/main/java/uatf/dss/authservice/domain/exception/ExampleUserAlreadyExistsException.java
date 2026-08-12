package uatf.dss.authservice.domain.exception;

public class ExampleUserAlreadyExistsException extends RuntimeException {
    public ExampleUserAlreadyExistsException(String email) {
        super("User already exists with email: " + email);
    }
}
