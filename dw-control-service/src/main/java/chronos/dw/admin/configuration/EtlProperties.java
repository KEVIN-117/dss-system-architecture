package chronos.dw.admin.configuration;

import java.net.URI;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;

/**
 * Load Manager settings ({@code app.etl.*}): Hop Server connection (LM-001 contract), the monitor that keeps
 * etl_control.etl_launch in sync with Hop, the DSA operating window and the scheduler (LM-004).
 */
@ConfigurationProperties(prefix = "app.etl")
public record EtlProperties(
        Hop hop, Monitoring monitoring, OperatingWindow operatingWindow, Scheduler scheduler, URI hopWebUrl) {

    @ConstructorBinding
    public EtlProperties {
        hop = hop == null ? new Hop(null, null, null, null, null, null) : hop;
        monitoring = monitoring == null ? new Monitoring(null, null, null, null, null, null) : monitoring;
        operatingWindow = operatingWindow == null ? new OperatingWindow(null, null, null, null) : operatingWindow;
        scheduler = scheduler == null ? new Scheduler(null, null, null, null, null) : scheduler;
    }

    /** Backwards-compatible constructor used before LM-004. */
    public EtlProperties(Hop hop, Monitoring monitoring, URI hopWebUrl) {
        this(hop, monitoring, null, null, hopWebUrl);
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

    /**
     * DSA operating hours. Scheduled DW updates must not run inside this window: schedules are rejected when one of
     * their next occurrences falls in it, and a due fire inside it is recorded as skipped.
     */
    public record OperatingWindow(List<DayOfWeek> days, LocalTime start, LocalTime end, ZoneId zone) {

        public OperatingWindow {
            days = days == null || days.isEmpty()
                    ? List.copyOf(EnumSet.range(DayOfWeek.MONDAY, DayOfWeek.FRIDAY))
                    : List.copyOf(days);
            start = start == null ? LocalTime.of(8, 0) : start;
            end = end == null ? LocalTime.of(18, 0) : end;
            zone = zone == null ? ZoneId.of("America/La_Paz") : zone;
            if (!start.isBefore(end)) {
                throw new IllegalArgumentException("app.etl.operating-window.start must be before end");
            }
        }

        public Set<DayOfWeek> daySet() {
            return EnumSet.copyOf(days);
        }
    }

    /**
     * Schedule firing.
     *
     * @param enabled fire due schedules from this instance (several instances are safe)
     * @param intervalMs delay between two checks for due schedules
     * @param leaseSeconds how long a claimed schedule is reserved for this instance
     * @param minInterval minimum time between two consecutive occurrences of a schedule
     * @param validationOccurrences how many next occurrences are checked against the operating window
     */
    public record Scheduler(
            Boolean enabled,
            Long intervalMs,
            Integer leaseSeconds,
            Duration minInterval,
            Integer validationOccurrences) {

        public Scheduler {
            enabled = enabled == null || enabled;
            intervalMs = intervalMs == null ? 30_000L : intervalMs;
            leaseSeconds = leaseSeconds == null ? 300 : leaseSeconds;
            minInterval = minInterval == null ? Duration.ofHours(1) : minInterval;
            validationOccurrences = validationOccurrences == null ? 20 : validationOccurrences;
            if (intervalMs < 5_000) {
                throw new IllegalArgumentException("app.etl.scheduler.interval-ms must be at least 5000");
            }
            if (leaseSeconds < 30 || leaseSeconds > 3600) {
                throw new IllegalArgumentException("app.etl.scheduler.lease-seconds must be between 30 and 3600");
            }
            if (validationOccurrences < 1 || validationOccurrences > 200) {
                throw new IllegalArgumentException(
                        "app.etl.scheduler.validation-occurrences must be between 1 and 200");
            }
        }
    }
}
