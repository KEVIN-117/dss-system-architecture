package chronos.dw.admin.domain.exception;

/** Duplicate name, stale row_version or a schedule being fired right now. Mapped to 409. */
public class EtlScheduleConflictException extends RuntimeException {

    public EtlScheduleConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}
