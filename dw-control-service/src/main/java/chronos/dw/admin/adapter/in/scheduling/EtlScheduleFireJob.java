package chronos.dw.admin.adapter.in.scheduling;

import chronos.dw.admin.application.port.in.FireDueEtlSchedulesUseCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Periodic check for due Load Manager schedules (LM-004). Safe with several instances. */
@Component
@ConditionalOnProperty(prefix = "app.etl.scheduler", name = "enabled", havingValue = "true", matchIfMissing = true)
public class EtlScheduleFireJob {

    private static final Logger LOG = LoggerFactory.getLogger(EtlScheduleFireJob.class);

    private final FireDueEtlSchedulesUseCase scheduler;

    public EtlScheduleFireJob(FireDueEtlSchedulesUseCase scheduler) {
        this.scheduler = scheduler;
    }

    @Scheduled(
            initialDelayString = "${app.etl.scheduler.interval-ms:30000}",
            fixedDelayString = "${app.etl.scheduler.interval-ms:30000}")
    public void fireDueSchedules() {
        try {
            scheduler.fireDueSchedules();
        } catch (RuntimeException exception) {
            LOG.warn("Load Manager scheduler round failed: {}", exception.getMessage());
        }
    }
}
