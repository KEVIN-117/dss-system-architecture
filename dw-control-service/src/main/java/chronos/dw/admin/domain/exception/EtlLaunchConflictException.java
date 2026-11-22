package chronos.dw.admin.domain.exception;

/** The launch cannot proceed with the current state: an active launch exists or the transition is invalid. */
public class EtlLaunchConflictException extends RuntimeException {

    public EtlLaunchConflictException(String message) {
        super(message);
    }

    public EtlLaunchConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}
