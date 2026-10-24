package chronos.dw.admin.domain.exception;

import java.util.UUID;

public class EtlExecutionNotFoundException extends RuntimeException {

    public EtlExecutionNotFoundException(UUID runId) {
        super("ETL execution not found: " + runId);
    }
}
