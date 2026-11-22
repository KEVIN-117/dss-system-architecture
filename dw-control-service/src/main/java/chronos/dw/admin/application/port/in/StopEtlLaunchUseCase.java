package chronos.dw.admin.application.port.in;

import chronos.dw.admin.domain.model.EtlLaunch;
import java.util.UUID;

public interface StopEtlLaunchUseCase {

    EtlLaunch stop(UUID launchId, String actor);
}
