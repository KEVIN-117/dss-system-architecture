package uatf.dss.authservice.domain.exception.conflict;

public class UserAlreadyExistsException extends ConflictException {
    public UserAlreadyExistsException() {
        super("A user with this email already exists.");
    }
}
