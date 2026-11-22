package chronos.dw.admin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import chronos.dw.admin.adapter.out.hop.HopServerClient;
import chronos.dw.admin.adapter.out.persistence.closure.JdbcAcademicClosureRepository;
import chronos.dw.admin.adapter.out.persistence.execution.JdbcEtlExecutionRepository;
import chronos.dw.admin.adapter.out.persistence.launch.JdbcEtlLaunchRepository;
import chronos.dw.admin.adapter.out.persistence.launch.JdbcEtlProcessCatalogRepository;
import chronos.dw.admin.application.service.EtlMonitoringService;
import chronos.dw.admin.application.service.LaunchEtlService;
import chronos.dw.admin.configuration.EtlProperties;
import chronos.dw.admin.configuration.LoadManagerConfiguration;
import chronos.dw.admin.domain.exception.EtlLaunchConflictException;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import chronos.dw.admin.domain.model.LaunchEtlCommand;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/**
 * End-to-end check of LM-003 against a real DW (migrations 0062-0065) and Hop Server (LM-001). Skipped unless
 * {@code LM_IT_DB_URL} is set; see docs/dw/load-manager-service.md for the command that provides the environment.
 * The DB login must only inherit dw_control_service, so the test also proves the grants of migration 0065.
 */
@EnabledIfEnvironmentVariable(named = "LM_IT_DB_URL", matches = "jdbc:postgresql:.*")
class LoadManagerHopIntegrationTest {

    @Test
    void catalogSyncRunsOnHopServerAndIsTrackedUntilItSucceeds() throws InterruptedException {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                System.getenv("LM_IT_DB_URL"), System.getenv("LM_IT_DB_USER"), System.getenv("LM_IT_DB_PASSWORD"));
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);

        EtlProperties properties = new EtlProperties(
                new EtlProperties.Hop(
                        URI.create(System.getenv("LM_IT_HOP_URL")),
                        System.getenv("LM_IT_HOP_USER"),
                        System.getenv("LM_IT_HOP_PASSWORD"),
                        Duration.ofSeconds(5),
                        Duration.ofSeconds(30),
                        "/files/project"),
                new EtlProperties.Monitoring(true, 1_000L, 20, Duration.ofMinutes(2), Duration.ofMinutes(5), 65_536),
                null);
        RestClient.Builder builder =
                RestClient.builder().baseUrl(properties.hop().baseUrl().toString());
        LoadManagerConfiguration.applyCredentials(builder, properties.hop());
        HopServerClient hop = new HopServerClient(builder.build(), properties);

        JdbcEtlLaunchRepository launches =
                new JdbcEtlLaunchRepository(jdbc, JsonMapper.builder().build());
        LaunchEtlService launchService = new LaunchEtlService(
                new JdbcEtlProcessCatalogRepository(jdbc),
                launches,
                hop,
                new JdbcAcademicClosureRepository(jdbc),
                new JdbcEtlExecutionRepository(jdbc));
        EtlMonitoringService monitor = new EtlMonitoringService(launches, hop, properties, Clock.systemUTC());

        assertEquals("Online", hop.serverStatus());

        EtlLaunch submitted = launchService.launch(LaunchEtlCommand.catalogSync("lm-003:integration"));
        assertEquals(EtlLaunchStatus.SUBMITTED, submitted.status());
        assertNotNull(submitted.hopExecutionId());
        assertThrows(
                EtlLaunchConflictException.class,
                () -> launchService.launch(LaunchEtlCommand.catalogSync("lm-003:integration")));

        Instant deadline = Instant.now().plusSeconds(120);
        EtlLaunch current = submitted;
        while (current.status().isActive() && Instant.now().isBefore(deadline)) {
            Thread.sleep(1_000);
            monitor.syncActiveLaunches();
            current = launches.findById(submitted.id()).orElseThrow();
        }

        assertEquals(EtlLaunchStatus.SUCCEEDED, current.status(), current.resultSummary());
        assertNotNull(current.finishedAt());
        assertNotNull(current.logExcerpt());
        assertTrue(current.logExcerpt().contains("wf_sync_academic_catalog"), current.logExcerpt());
        Integer events = jdbc.queryForObject(
                "SELECT count(*) FROM etl_control.etl_launch_event WHERE launch_id = ?", Integer.class, submitted.id());
        assertTrue(events != null && events >= 3, "REQUESTED + SUBMITTED + SUCCEEDED expected");
    }
}
