package chronos.dw.admin.domain.exception;

/** Hop Server answered but rejected the request (webresult ERROR), for example an invalid workflow. */
public class HopRequestRejectedException extends RuntimeException {

    public HopRequestRejectedException(String message) {
        super(message);
    }
}
