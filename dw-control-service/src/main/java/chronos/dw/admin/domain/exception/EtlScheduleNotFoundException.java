package chronos.dw.admin.domain.exception;

public class EtlScheduleNotFoundException extends RuntimeException {

    public EtlScheduleNotFoundException(long scheduleId) {
        super("ETL schedule not found: " + scheduleId);
    }
}
