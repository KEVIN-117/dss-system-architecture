package chronos.dw.admin.adapter.in.scheduling;

import chronos.dw.admin.application.port.in.SyncActiveEtlLaunchesUseCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Periodic synchronization of active Load Manager launches with Hop Server. */
@Component
@ConditionalOnProperty(prefix = "app.etl.monitoring", name = "enabled", havingValue = "true", matchIfMissing = true)
public class EtlLaunchMonitorJob {

    private static final Logger LOG = LoggerFactory.getLogger(EtlLaunchMonitorJob.class);

    private final SyncActiveEtlLaunchesUseCase monitoring;

    public EtlLaunchMonitorJob(SyncActiveEtlLaunchesUseCase monitoring) {
        this.monitoring = monitoring;
    }

    @Scheduled(
            initialDelayString = "${app.etl.monitoring.interval-ms:5000}",
            fixedDelayString = "${app.etl.monitoring.interval-ms:5000}")
    public void syncActiveLaunches() {
        try {
            int changed = monitoring.syncActiveLaunches();
            if (changed > 0) {
                LOG.info("Load Manager monitor updated {} launch(es)", changed);
            }
        } catch (RuntimeException exception) {
            LOG.warn("Load Manager monitor round failed: {}", exception.getMessage());
        }
    }
}
