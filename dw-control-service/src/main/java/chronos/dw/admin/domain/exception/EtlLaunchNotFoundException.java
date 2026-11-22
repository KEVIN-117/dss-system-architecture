package chronos.dw.admin.domain.exception;

import java.util.UUID;

public class EtlLaunchNotFoundException extends RuntimeException {

    public EtlLaunchNotFoundException(UUID launchId) {
        super("ETL launch not found: " + launchId);
    }
}
