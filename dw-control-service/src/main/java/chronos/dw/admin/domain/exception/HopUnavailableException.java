package chronos.dw.admin.domain.exception;

/** Hop Server could not be reached or answered with an unexpected HTTP error. Mapped to 503. */
public class HopUnavailableException extends RuntimeException {

    public HopUnavailableException(String message) {
        super(message);
    }

    public HopUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
