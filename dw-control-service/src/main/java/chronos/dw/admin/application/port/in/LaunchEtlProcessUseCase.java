package chronos.dw.admin.application.port.in;

import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.LaunchEtlCommand;

public interface LaunchEtlProcessUseCase {

    EtlLaunch launch(LaunchEtlCommand command);
}
