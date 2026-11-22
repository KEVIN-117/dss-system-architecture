package chronos.dw.admin.application.port.in;

public interface SyncActiveEtlLaunchesUseCase {

    /**
     * Refreshes active launches from Hop Server.
     *
     * @return number of launches that changed status
     */
    int syncActiveLaunches();
}
