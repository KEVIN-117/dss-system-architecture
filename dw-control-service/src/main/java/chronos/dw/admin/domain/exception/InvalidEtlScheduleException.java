package chronos.dw.admin.domain.exception;

/** The schedule definition is invalid (cron, zone, frequency or DSA operating window). Mapped to 400. */
public class InvalidEtlScheduleException extends RuntimeException {

    public InvalidEtlScheduleException(String message) {
        super(message);
    }
}
