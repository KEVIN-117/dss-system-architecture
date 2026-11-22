package chronos.dw.admin.configuration;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Enables Spring scheduling for the Load Manager jobs. Set {@code app.etl.monitoring.enabled=false} to run an
 * instance that serves the API only.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "app.etl.monitoring", name = "enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfiguration {}
