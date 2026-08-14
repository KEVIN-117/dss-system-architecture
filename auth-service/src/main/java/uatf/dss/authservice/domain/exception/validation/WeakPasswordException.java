package uatf.dss.authservice.domain.exception.validation;

public class WeakPasswordException extends ValidationException {
    public WeakPasswordException() {
        super("The provided password is too weak.");
    }

    public WeakPasswordException(String message) {
        super(message);
    }
}
