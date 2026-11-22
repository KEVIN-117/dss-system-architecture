package chronos.dw.admin.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import chronos.dw.admin.configuration.EtlProperties;
import chronos.dw.admin.domain.exception.HopUnavailableException;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import chronos.dw.admin.domain.model.EtlLaunchTrigger;
import chronos.dw.admin.domain.model.HopRunStatus;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class EtlMonitoringServiceTest {

    private static final UUID HOP_ID = UUID.fromString("44444444-4444-4444-8444-444444444444");

    private final Clock clock = Clock.fixed(LoadManagerFakes.NOW, ZoneOffset.UTC);
    private LoadManagerFakes.Launches launches;
    private LoadManagerFakes.Hop hop;
    private EtlMonitoringService service;

    @BeforeEach
    void setUp() {
        launches = new LoadManagerFakes.Launches(clock);
        hop = new LoadManagerFakes.Hop();
        EtlProperties properties = new EtlProperties(
                null,
                new EtlProperties.Monitoring(true, 5_000L, 20, Duration.ofMinutes(2), Duration.ofMinutes(5), 4096),
                null);
        service = new EtlMonitoringService(launches, hop, properties, clock);
    }

    @Test
    void submittedLaunchBecomesRunningWithItsLog() {
        EtlLaunch launch = submitted(UUID.randomUUID(), HOP_ID, LoadManagerFakes.NOW.minusSeconds(10));
        hop.statuses.put(HOP_ID, new HopRunStatus(HopRunStatus.State.RUNNING, "Running", null, "línea 1\nlínea 2"));

        assertEquals(1, service.syncActiveLaunches());

        EtlLaunch updated = launches.rows.get(launch.id());
        assertEquals(EtlLaunchStatus.RUNNING, updated.status());
        assertEquals("línea 1\nlínea 2", updated.logExcerpt());
    }

    @Test
    void runningLaunchOnlyRefreshesItsLog() {
        EtlLaunch launch = submitted(UUID.randomUUID(), HOP_ID, LoadManagerFakes.NOW.minusSeconds(10));
        launches.transition(launch.id(), EtlLaunchStatus.RUNNING, "test", null, null, null);
        hop.statuses.put(HOP_ID, new HopRunStatus(HopRunStatus.State.RUNNING, "Running", null, "progreso"));

        assertEquals(0, service.syncActiveLaunches());
        assertEquals("progreso", launches.rows.get(launch.id()).logExcerpt());
    }

    @Test
    void finishedLaunchSucceedsAndIsRemovedFromHop() {
        EtlLaunch launch = submitted(UUID.randomUUID(), HOP_ID, LoadManagerFakes.NOW.minusSeconds(10));
        hop.statuses.put(HOP_ID, new HopRunStatus(HopRunStatus.State.SUCCEEDED, "Finished", null, "ok"));

        service.syncActiveLaunches();

        EtlLaunch updated = launches.rows.get(launch.id());
        assertEquals(EtlLaunchStatus.SUCCEEDED, updated.status());
        assertNotNull(updated.finishedAt());
        assertTrue(hop.calls.contains("remove:" + HOP_ID));
    }

    @Test
    void failedLaunchSummarizesTheLastSanitizedErrorLine() {
        EtlLaunch launch = submitted(UUID.randomUUID(), HOP_ID, LoadManagerFakes.NOW.minusSeconds(10));
        String log =
                """
                2026/11/22 06:00:00 - Sync faculties - Starting
                2026/11/22 06:00:01 - Upsert - ERROR: password=secreto123 connection refused
                """;
        hop.statuses.put(HOP_ID, new HopRunStatus(HopRunStatus.State.FAILED, "Finished (with errors)", null, log));

        service.syncActiveLaunches();

        EtlLaunch updated = launches.rows.get(launch.id());
        assertEquals(EtlLaunchStatus.FAILED, updated.status());
        assertEquals("Upsert: password=*** connection refused", updated.resultSummary());
        assertFalse(updated.logExcerpt().contains("secreto123"));
    }

    @Test
    void stoppedLaunchMentionsWhoAskedForIt() {
        EtlLaunch launch = submitted(UUID.randomUUID(), HOP_ID, LoadManagerFakes.NOW.minusSeconds(10));
        launches.requestStop(launch.id(), "admin:test");
        hop.statuses.put(HOP_ID, new HopRunStatus(HopRunStatus.State.STOPPED, "Stopped", null, ""));

        service.syncActiveLaunches();

        EtlLaunch updated = launches.rows.get(launch.id());
        assertEquals(EtlLaunchStatus.STOPPED, updated.status());
        assertEquals("Detenido a pedido de admin:test", updated.resultSummary());
    }

    @Test
    void pendingStopIsResentWhileHopStillRuns() {
        EtlLaunch launch = submitted(UUID.randomUUID(), HOP_ID, LoadManagerFakes.NOW.minusSeconds(10));
        launches.requestStop(launch.id(), "admin:test");
        hop.statuses.put(HOP_ID, new HopRunStatus(HopRunStatus.State.RUNNING, "Running", null, ""));

        service.syncActiveLaunches();

        assertTrue(hop.calls.contains("stop:" + HOP_ID));
    }

    @Test
    void launchUnknownToHopFailsOnlyAfterTheGracePeriod() {
        EtlLaunch recent = submitted(UUID.randomUUID(), HOP_ID, LoadManagerFakes.NOW.minusSeconds(30));

        assertEquals(0, service.syncActiveLaunches());
        assertEquals(EtlLaunchStatus.SUBMITTED, launches.rows.get(recent.id()).status());

        UUID oldHop = UUID.randomUUID();
        EtlLaunch old = submitted(UUID.randomUUID(), oldHop, LoadManagerFakes.NOW.minus(Duration.ofMinutes(10)));
        launches.rows.remove(recent.id());

        assertEquals(1, service.syncActiveLaunches());
        assertEquals(EtlLaunchStatus.FAILED, launches.rows.get(old.id()).status());
    }

    @Test
    void queuedLaunchThatNeverReachedHopExpires() {
        EtlLaunch lost = launches.put(queued(UUID.randomUUID(), LoadManagerFakes.NOW.minus(Duration.ofMinutes(6))));

        assertEquals(1, service.syncActiveLaunches());
        assertEquals(EtlLaunchStatus.SUBMIT_FAILED, launches.rows.get(lost.id()).status());
    }

    @Test
    void unavailableHopEndsTheRoundWithoutChanges() {
        submitted(UUID.randomUUID(), HOP_ID, LoadManagerFakes.NOW.minusSeconds(10));
        submitted(UUID.randomUUID(), UUID.randomUUID(), LoadManagerFakes.NOW.minusSeconds(5));
        hop.statusFailure = new HopUnavailableException("down");

        assertEquals(0, service.syncActiveLaunches());
        assertEquals(1, hop.calls.size());
    }

    private EtlLaunch submitted(UUID launchId, UUID hopId, Instant submittedAt) {
        EtlLaunch launch = new EtlLaunch(
                launchId,
                "CATALOG_SYNC" + launchId,
                EtlLaunchTrigger.MANUAL,
                null,
                null,
                null,
                Map.of(),
                EtlLaunchStatus.SUBMITTED,
                hopId,
                "admin:test",
                submittedAt,
                submittedAt,
                null,
                null,
                null,
                null,
                null,
                null,
                2);
        return launches.put(launch);
    }

    private static EtlLaunch queued(UUID launchId, Instant requestedAt) {
        return new EtlLaunch(
                launchId,
                "CATALOG_SYNC",
                EtlLaunchTrigger.MANUAL,
                null,
                null,
                null,
                Map.of(),
                EtlLaunchStatus.QUEUED,
                null,
                "admin:test",
                requestedAt,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                1);
    }
}
