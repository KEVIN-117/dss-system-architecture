package chronos.dw.admin.adapter.in.rest.loadmanager;

import java.util.List;

/** Whether any ETL is running right now (portal header indicator). */
public record EtlStatusResponse(boolean running, List<EtlLaunchResponse> active) {

    public EtlStatusResponse {
        active = List.copyOf(active);
    }
}
