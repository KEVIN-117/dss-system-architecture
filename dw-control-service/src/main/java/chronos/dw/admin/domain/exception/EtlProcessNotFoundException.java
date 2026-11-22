package chronos.dw.admin.domain.exception;

public class EtlProcessNotFoundException extends RuntimeException {

    public EtlProcessNotFoundException(String processCode) {
        super("ETL process not found: " + processCode);
    }
}
