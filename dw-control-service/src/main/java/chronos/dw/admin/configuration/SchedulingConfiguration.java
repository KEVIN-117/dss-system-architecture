package chronos.dw.admin.configuration;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Enables Spring scheduling for the Load Manager jobs. Each job has its own switch: {@code app.etl.monitoring.enabled}
 * (launch monitor) and {@code app.etl.scheduler.enabled} (schedule firing). Turn both off to run an API-only
 * instance.
 */
@Configuration
@EnableScheduling
public class SchedulingConfiguration {}
