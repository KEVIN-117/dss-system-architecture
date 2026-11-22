package chronos.dw.admin.application.port.out;

import chronos.dw.admin.application.model.ExecutionPage;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchSearchCriteria;

public interface QueryEtlLaunchesPort {

    /** Launches matching the criteria, newest first. */
    ExecutionPage<EtlLaunch> find(EtlLaunchSearchCriteria criteria, int page, int size);
}
