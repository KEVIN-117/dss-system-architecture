package chronos.dw.admin.domain.exception;

/** The launch request does not satisfy the process contract (missing or invalid parameters). */
public class InvalidEtlLaunchRequestException extends RuntimeException {

    public InvalidEtlLaunchRequestException(String message) {
        super(message);
    }
}
