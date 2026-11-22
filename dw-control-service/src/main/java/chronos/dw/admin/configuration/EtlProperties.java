package chronos.dw.admin.configuration;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Load Manager settings ({@code app.etl.*}): Hop Server connection (LM-001 contract) and the monitor that keeps
 * etl_control.etl_launch in sync with Hop.
 */
@ConfigurationProperties(prefix = "app.etl")
public record EtlProperties(Hop hop, Monitoring monitoring, URI hopWebUrl) {

    public EtlProperties {
        hop = hop == null ? new Hop(null, null, null, null, null, null) : hop;
        monitoring = monitoring == null ? new Monitoring(null, null, null, null, null, null) : monitoring;
    }

    /**
     * Hop Server API. Credentials are the HOP_SERVER_USER / HOP_SERVER_PASS shared with the hop-server container.
     */
    public record Hop(
            URI baseUrl,
            String username,
            String password,
            Duration connectTimeout,
            Duration readTimeout,
            String projectHome) {

        public Hop {
            baseUrl = baseUrl == null ? URI.create("http://hop-server:8080") : baseUrl;
            connectTimeout = connectTimeout == null ? Duration.ofSeconds(5) : connectTimeout;
            readTimeout = readTimeout == null ? Duration.ofSeconds(30) : readTimeout;
            projectHome = projectHome == null || projectHome.isBlank() ? "/files/project" : projectHome.trim();
        }

        public boolean hasCredentials() {
            return username != null && !username.isBlank() && password != null && !password.isBlank();
        }
    }

    /**
     * Active-launch synchronization.
     *
     * @param enabled run the periodic monitor in this instance
     * @param intervalMs delay between two synchronization rounds
     * @param batchSize maximum active launches checked per round
     * @param notFoundGrace how long after submission a launch Hop no longer reports is still waited for
     * @param queuedGrace how long a launch may stay QUEUED before it is considered lost
     * @param logExcerptMaxChars size of the log tail stored with the launch
     */
    public record Monitoring(
            Boolean enabled,
            Long intervalMs,
            Integer batchSize,
            Duration notFoundGrace,
            Duration queuedGrace,
            Integer logExcerptMaxChars) {

        public Monitoring {
            enabled = enabled == null || enabled;
            intervalMs = intervalMs == null ? 5_000L : intervalMs;
            batchSize = batchSize == null ? 20 : batchSize;
            notFoundGrace = notFoundGrace == null ? Duration.ofMinutes(2) : notFoundGrace;
            queuedGrace = queuedGrace == null ? Duration.ofMinutes(5) : queuedGrace;
            logExcerptMaxChars = logExcerptMaxChars == null ? 65_536 : logExcerptMaxChars;
            if (intervalMs < 1_000) {
                throw new IllegalArgumentException("app.etl.monitoring.interval-ms must be at least 1000");
            }
            if (batchSize < 1 || batchSize > 100) {
                throw new IllegalArgumentException("app.etl.monitoring.batch-size must be between 1 and 100");
            }
            if (logExcerptMaxChars < 1_024 || logExcerptMaxChars > 65_536) {
                throw new IllegalArgumentException(
                        "app.etl.monitoring.log-excerpt-max-chars must be between 1024 and 65536");
            }
        }
    }
}
