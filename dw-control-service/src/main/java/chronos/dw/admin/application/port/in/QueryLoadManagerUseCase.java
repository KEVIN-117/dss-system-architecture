package chronos.dw.admin.application.port.in;

import chronos.dw.admin.application.model.ExecutionPage;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchSearchCriteria;
import chronos.dw.admin.domain.model.EtlProcess;
import chronos.dw.admin.domain.model.LoadManagerHealth;
import java.util.List;
import java.util.UUID;

/** Read side of the Load Manager API. */
public interface QueryLoadManagerUseCase {

    List<EtlProcess> processes();

    ExecutionPage<EtlLaunch> launches(EtlLaunchSearchCriteria criteria, int page, int size);

    EtlLaunch launch(UUID launchId);

    /** Launches currently queued, submitted or running (for the portal header). */
    List<EtlLaunch> activeLaunches();

    LoadManagerHealth health();
}
