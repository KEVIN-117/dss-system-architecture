package chronos.dw.admin.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import chronos.dw.admin.domain.exception.EtlLaunchConflictException;
import chronos.dw.admin.domain.exception.EtlLaunchNotFoundException;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class StopEtlLaunchServiceTest {

    private final Clock clock = Clock.fixed(LoadManagerFakes.NOW, ZoneOffset.UTC);
    private LoadManagerFakes.Launches launches;
    private LoadManagerFakes.Hop hop;
    private StopEtlLaunchService service;

    @BeforeEach
    void setUp() {
        launches = new LoadManagerFakes.Launches(clock);
        hop = new LoadManagerFakes.Hop();
        service = new StopEtlLaunchService(launches, hop);
    }

    @Test
    void queuedLaunchStopsImmediately() {
        EtlLaunch queued =
                launches.request(UUID.randomUUID(), "CATALOG_SYNC", "admin:test", Map.of(), null, null, null);

        EtlLaunch stopped = service.stop(queued.id(), "admin:test");

        assertEquals(EtlLaunchStatus.STOPPED, stopped.status());
        assertEquals("admin:test", stopped.stopRequestedBy());
        assertTrue(hop.calls.isEmpty());
    }

    @Test
    void submittedLaunchAsksHopToStop() {
        EtlLaunch queued =
                launches.request(UUID.randomUUID(), "CATALOG_SYNC", "admin:test", Map.of(), null, null, null);
        UUID hopId = UUID.randomUUID();
        launches.transition(queued.id(), EtlLaunchStatus.SUBMITTED, "svc", hopId, null, null);

        EtlLaunch requested = service.stop(queued.id(), "admin:test");

        assertEquals(EtlLaunchStatus.SUBMITTED, requested.status());
        assertTrue(requested.stopRequested());
        assertEquals(java.util.List.of("stop:" + hopId), hop.calls);
    }

    @Test
    void finishedOrUnknownLaunchCannotBeStopped() {
        EtlLaunch queued =
                launches.request(UUID.randomUUID(), "CATALOG_SYNC", "admin:test", Map.of(), null, null, null);
        launches.transition(queued.id(), EtlLaunchStatus.SUBMIT_FAILED, "svc", null, "x", null);

        assertThrows(EtlLaunchConflictException.class, () -> service.stop(queued.id(), "admin:test"));
        assertThrows(EtlLaunchNotFoundException.class, () -> service.stop(UUID.randomUUID(), "admin:test"));
    }
}
