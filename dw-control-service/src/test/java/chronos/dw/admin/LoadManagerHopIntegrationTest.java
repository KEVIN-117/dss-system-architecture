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
import chronos.dw.admin.adapter.out.persistence.launch.JdbcEtlScheduleRepository;
import chronos.dw.admin.application.service.EtlMonitoringService;
import chronos.dw.admin.application.service.LaunchEtlService;
import chronos.dw.admin.application.service.OperatingWindowPolicy;
import chronos.dw.admin.application.service.ScheduleService;
import chronos.dw.admin.application.service.ScheduledFireService;
import chronos.dw.admin.configuration.EtlProperties;
import chronos.dw.admin.configuration.LoadManagerConfiguration;
import chronos.dw.admin.domain.exception.EtlLaunchConflictException;
import chronos.dw.admin.domain.exception.InvalidEtlScheduleException;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import chronos.dw.admin.domain.model.EtlLaunchTrigger;
import chronos.dw.admin.domain.model.EtlSchedule;
import chronos.dw.admin.domain.model.EtlScheduleDefinition;
import chronos.dw.admin.domain.model.LaunchEtlCommand;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
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
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class LoadManagerHopIntegrationTest {

    /** Monday 2026-11-23 02:00 in La Paz: outside the DSA operating window. */
    private static final Instant NIGHT = Instant.parse("2026-11-23T06:00:00Z");

    @Test
    @Order(1)
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

    /** LM-004: schedules created through the real functions and fired by the scheduler with a night clock. */
    @Test
    @Order(2)
    void dueSchedulesAreFiredOrRecordedAsSkipped() throws InterruptedException {
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
                System.getenv("LM_IT_DB_URL"), System.getenv("LM_IT_DB_USER"), System.getenv("LM_IT_DB_PASSWORD")));
        JdbcTemplate admin = new JdbcTemplate(new DriverManagerDataSource(
                System.getenv("LM_IT_DB_URL"),
                System.getenv("LM_IT_ADMIN_DB_USER"),
                System.getenv("LM_IT_ADMIN_DB_PASSWORD")));
        EtlProperties properties = new EtlProperties(
                new EtlProperties.Hop(
                        URI.create(System.getenv("LM_IT_HOP_URL")),
                        System.getenv("LM_IT_HOP_USER"),
                        System.getenv("LM_IT_HOP_PASSWORD"),
                        Duration.ofSeconds(5),
                        Duration.ofSeconds(30),
                        "/files/project"),
                null,
                null);
        RestClient.Builder builder =
                RestClient.builder().baseUrl(properties.hop().baseUrl().toString());
        LoadManagerConfiguration.applyCredentials(builder, properties.hop());
        HopServerClient hop = new HopServerClient(builder.build(), properties);
        Clock night = Clock.fixed(NIGHT, ZoneOffset.UTC);
        OperatingWindowPolicy policy = new OperatingWindowPolicy(properties);

        JdbcEtlScheduleRepository scheduleRepository = new JdbcEtlScheduleRepository(jdbc);
        JdbcEtlLaunchRepository launches =
                new JdbcEtlLaunchRepository(jdbc, JsonMapper.builder().build());
        JdbcAcademicClosureRepository closures = new JdbcAcademicClosureRepository(jdbc);
        JdbcEtlProcessCatalogRepository catalog = new JdbcEtlProcessCatalogRepository(jdbc);
        ScheduleService schedules = new ScheduleService(scheduleRepository, catalog, policy, night);
        LaunchEtlService launcher =
                new LaunchEtlService(catalog, launches, hop, closures, new JdbcEtlExecutionRepository(jdbc));
        ScheduledFireService scheduler =
                new ScheduledFireService(scheduleRepository, launches, launcher, closures, policy, properties, night);

        String suffix = Long.toString(System.nanoTime());
        EtlSchedule catalogSchedule = schedules.create(
                new EtlScheduleDefinition("CATALOG_SYNC", "IT catálogo " + suffix, "0 0 2 * * *", null, true),
                "lm-004:integration");
        EtlSchedule verticalSchedule = schedules.create(
                new EtlScheduleDefinition("VERTICAL_LOAD", "IT vertical " + suffix, "0 30 2 * * *", null, true),
                "lm-004:integration");
        assertThrows(
                InvalidEtlScheduleException.class,
                () -> schedules.create(
                        new EtlScheduleDefinition("CATALOG_SYNC", "IT oficina " + suffix, "0 0 10 * * *", null, true),
                        "lm-004:integration"));

        // Make both due now; the service login has no direct DML, the admin login stands in for time passing.
        admin.update(
                "UPDATE etl_control.etl_schedule SET next_fire_at = clock_timestamp() - interval '1 minute'"
                        + " WHERE schedule_id IN (?, ?)",
                catalogSchedule.id(),
                verticalSchedule.id());

        assertTrue(scheduler.fireDueSchedules() >= 2);

        EtlSchedule firedCatalog =
                scheduleRepository.findById(catalogSchedule.id()).orElseThrow();
        EtlSchedule firedVertical =
                scheduleRepository.findById(verticalSchedule.id()).orElseThrow();
        assertNotNull(firedCatalog.lastLaunchId());
        assertNotNull(firedCatalog.lastFiredAt());
        assertEquals(Instant.parse("2026-11-24T06:00:00Z"), firedCatalog.nextFireAt());
        assertEquals(null, firedCatalog.claimToken());

        EtlLaunch catalogLaunch = launches.findById(firedCatalog.lastLaunchId()).orElseThrow();
        assertEquals(EtlLaunchTrigger.SCHEDULED, catalogLaunch.trigger());
        assertEquals(EtlLaunchStatus.SUBMITTED, catalogLaunch.status());

        EtlLaunch verticalLaunch =
                launches.findById(firedVertical.lastLaunchId()).orElseThrow();
        assertEquals(EtlLaunchStatus.SKIPPED, verticalLaunch.status());
        assertEquals("No hay cierres académicos CERRADO pendientes de procesar", verticalLaunch.resultSummary());

        Integer events = jdbc.queryForObject(
                "SELECT count(*) FROM etl_control.etl_schedule_event"
                        + " WHERE (schedule_id = ? AND event_type = 'FIRED')"
                        + " OR (schedule_id = ? AND event_type = 'SKIPPED')",
                Integer.class,
                catalogSchedule.id(),
                verticalSchedule.id());
        assertEquals(2, events);

        // Let the scheduled catalog run finish so a rerun starts clean.
        EtlMonitoringService monitor = new EtlMonitoringService(launches, hop, properties, Clock.systemUTC());
        Instant deadline = Instant.now().plusSeconds(120);
        EtlLaunch current = catalogLaunch;
        while (current.status().isActive() && Instant.now().isBefore(deadline)) {
            Thread.sleep(1_000);
            monitor.syncActiveLaunches();
            current = launches.findById(catalogLaunch.id()).orElseThrow();
        }
        assertEquals(EtlLaunchStatus.SUCCEEDED, current.status(), current.resultSummary());

        schedules.delete(firedCatalog.id(), firedCatalog.rowVersion(), "lm-004:integration");
        schedules.delete(firedVertical.id(), firedVertical.rowVersion(), "lm-004:integration");
    }
}
