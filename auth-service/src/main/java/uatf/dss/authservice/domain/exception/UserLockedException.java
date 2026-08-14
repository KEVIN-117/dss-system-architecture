package uatf.dss.authservice.domain.exception;

public class UserLockedException extends DomainException {
    public UserLockedException() {
        super("This account is locked due to multiple failed attempts.");
    }

    public UserLockedException(String message) {
        super(message);
    }

    @Override
    public int getHttpStatus() {
        return 423;
    }
}
