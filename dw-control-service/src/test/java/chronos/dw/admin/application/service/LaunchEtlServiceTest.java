package chronos.dw.admin.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import chronos.dw.admin.application.model.ClosurePage;
import chronos.dw.admin.application.model.ExecutionPage;
import chronos.dw.admin.application.port.out.QueryAcademicClosurePort;
import chronos.dw.admin.application.port.out.QueryEtlExecutionsPort;
import chronos.dw.admin.domain.exception.AcademicClosureNotFoundException;
import chronos.dw.admin.domain.exception.EtlLaunchConflictException;
import chronos.dw.admin.domain.exception.EtlProcessNotFoundException;
import chronos.dw.admin.domain.exception.HopRequestRejectedException;
import chronos.dw.admin.domain.exception.HopUnavailableException;
import chronos.dw.admin.domain.exception.InvalidEtlLaunchRequestException;
import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import chronos.dw.admin.domain.model.AcademicPeriodClosureEvent;
import chronos.dw.admin.domain.model.ClosureStatus;
import chronos.dw.admin.domain.model.EtlExecutionError;
import chronos.dw.admin.domain.model.EtlExecutionKind;
import chronos.dw.admin.domain.model.EtlExecutionMetric;
import chronos.dw.admin.domain.model.EtlExecutionSearchCriteria;
import chronos.dw.admin.domain.model.EtlExecutionStatus;
import chronos.dw.admin.domain.model.EtlExecutionStep;
import chronos.dw.admin.domain.model.EtlExecutionSummary;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import chronos.dw.admin.domain.model.EtlLaunchTrigger;
import chronos.dw.admin.domain.model.LaunchEtlCommand;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LaunchEtlServiceTest {

    private static final UUID LAUNCH_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID RUN_ID = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID PREVIOUS_RUN = UUID.fromString("33333333-3333-4333-8333-333333333333");

    private final Clock clock = Clock.fixed(LoadManagerFakes.NOW, ZoneOffset.UTC);
    private final Map<Long, AcademicPeriodClosure> closures = new HashMap<>();
    private final Map<UUID, EtlExecutionSummary> executions = new HashMap<>();
    private LoadManagerFakes.Launches launches;
    private LoadManagerFakes.Hop hop;
    private LaunchEtlService service;

    @BeforeEach
    void setUp() {
        launches = new LoadManagerFakes.Launches(clock);
        hop = new LoadManagerFakes.Hop();
        Deque<UUID> ids = new ArrayDeque<>(List.of(LAUNCH_ID, RUN_ID));
        service = new LaunchEtlService(
                new LoadManagerFakes.Catalog(
                        LoadManagerFakes.vertical(),
                        LoadManagerFakes.catalogSync(true),
                        LoadManagerFakes.publishStaged()),
                launches,
                hop,
                closurePort(),
                executionPort(),
                () -> ids.isEmpty() ? UUID.randomUUID() : ids.pop());
    }

    @Test
    void submitsCatalogSyncWithoutParameters() {
        EtlLaunch launch = service.launch(LaunchEtlCommand.catalogSync("admin:test"));

        assertEquals(EtlLaunchStatus.SUBMITTED, launch.status());
        assertEquals(hop.nextExecutionId, launch.hopExecutionId());
        assertEquals(EtlLaunchTrigger.MANUAL, launch.trigger());
        assertEquals("workflows/wf_sync_academic_catalog.hwf", hop.lastWorkflowFile);
        assertTrue(hop.lastParameters.isEmpty());
        assertEquals(List.of("QUEUED->SUBMITTED"), launches.transitions);
    }

    @Test
    void closureLoadSendsTheClosurePeriodAndANewRunId() {
        closures.put(7L, closure(7L, ClosureStatus.CERRADO));

        EtlLaunch launch = service.launch(LaunchEtlCommand.closureLoad(7L, "admin:test"));

        assertEquals(RUN_ID, launch.runId());
        assertEquals(7L, launch.closureId());
        assertEquals(
                Map.of(
                        "P_RUN_ID", RUN_ID.toString(),
                        "P_REQUESTED_GESTION", "2026",
                        "P_REQUESTED_PERIODO", "2",
                        "P_EXECUTION_KIND", "CIERRE_ACADEMICO"),
                hop.lastParameters);
    }

    @Test
    void rejectsAClosureThatIsNotClosed() {
        closures.put(8L, closure(8L, ClosureStatus.PENDIENTE));

        assertThrows(
                InvalidEtlLaunchRequestException.class,
                () -> service.launch(LaunchEtlCommand.closureLoad(8L, "admin:test")));
        assertThrows(
                AcademicClosureNotFoundException.class,
                () -> service.launch(LaunchEtlCommand.closureLoad(99L, "admin:test")));
        assertTrue(launches.rows.isEmpty());
        assertTrue(hop.calls.isEmpty());
    }

    @Test
    void reprocessTakesThePeriodFromThePreviousRun() {
        executions.put(PREVIOUS_RUN, execution(PREVIOUS_RUN, 2025, 1));

        service.launch(LaunchEtlCommand.reprocess(PREVIOUS_RUN, "admin:test"));

        assertEquals("REPROCESO", hop.lastParameters.get("P_EXECUTION_KIND"));
        assertEquals(PREVIOUS_RUN.toString(), hop.lastParameters.get("P_RETRY_OF_RUN_ID"));
        assertEquals("2025", hop.lastParameters.get("P_REQUESTED_GESTION"));
        assertEquals("1", hop.lastParameters.get("P_REQUESTED_PERIODO"));
    }

    @Test
    void verticalLoadRequiresAManagerSupportedKind() {
        LaunchEtlCommand historical =
                new LaunchEtlCommand("VERTICAL_LOAD", "admin:test", EtlExecutionKind.HISTORICA, null, null, null, null);

        assertThrows(InvalidEtlLaunchRequestException.class, () -> service.launch(historical));
    }

    @Test
    void publishStagedSendsTheExistingRun() {
        executions.put(PREVIOUS_RUN, execution(PREVIOUS_RUN, 2025, 1));

        EtlLaunch launch = service.launch(LaunchEtlCommand.publishStaged(PREVIOUS_RUN, "admin:test"));

        assertEquals(PREVIOUS_RUN, launch.runId());
        assertEquals(Map.of("P_RUN_ID", PREVIOUS_RUN.toString()), hop.lastParameters);
    }

    @Test
    void rejectsUnknownAndDisabledProcesses() {
        assertThrows(
                EtlProcessNotFoundException.class,
                () -> service.launch(new LaunchEtlCommand("NOPE", "admin:test", null, null, null, null, null)));

        LaunchEtlService disabled = new LaunchEtlService(
                new LoadManagerFakes.Catalog(LoadManagerFakes.catalogSync(false)),
                launches,
                hop,
                closurePort(),
                executionPort(),
                UUID::randomUUID);
        assertThrows(
                InvalidEtlLaunchRequestException.class,
                () -> disabled.launch(LaunchEtlCommand.catalogSync("admin:test")));
    }

    @Test
    void secondActiveLaunchIsAConflict() {
        service.launch(LaunchEtlCommand.catalogSync("admin:test"));

        assertThrows(
                EtlLaunchConflictException.class, () -> service.launch(LaunchEtlCommand.catalogSync("admin:otro")));
        assertEquals(1, hop.calls.size());
    }

    @Test
    void unavailableHopIsRecordedAsSubmitFailedAndPropagated() {
        hop.submitFailure = new HopUnavailableException("down");

        assertThrows(HopUnavailableException.class, () -> service.launch(LaunchEtlCommand.catalogSync("admin:test")));

        EtlLaunch failed = launches.rows.get(LAUNCH_ID);
        assertEquals(EtlLaunchStatus.SUBMIT_FAILED, failed.status());
        assertNull(failed.hopExecutionId());
        assertTrue(failed.resultSummary().contains("Hop Server no está disponible"));
    }

    @Test
    void rejectedSubmissionReturnsTheFailedLaunch() {
        hop.submitFailure = new HopRequestRejectedException("Hop Server rejected registerWorkflow: bad workflow");

        EtlLaunch failed = service.launch(LaunchEtlCommand.catalogSync("admin:test"));

        assertEquals(EtlLaunchStatus.SUBMIT_FAILED, failed.status());
        assertTrue(failed.resultSummary().contains("bad workflow"));
    }

    @Test
    void scheduledCommandIsLinkedToItsSchedule() {
        EtlLaunch launch =
                service.launch(LaunchEtlCommand.catalogSync("scheduler").scheduledBy(42L));

        assertEquals(EtlLaunchTrigger.SCHEDULED, launch.trigger());
        assertEquals(42L, launch.scheduleId());
    }

    private static AcademicPeriodClosure closure(long id, ClosureStatus status) {
        boolean closed = status == ClosureStatus.CERRADO;
        Instant at = Instant.parse("2026-11-01T00:00:00Z");
        return new AcademicPeriodClosure(
                id,
                2026,
                2,
                status,
                closed ? at : null,
                closed ? "dsa:test" : null,
                "dsa:test",
                "Fixture",
                1,
                null,
                null,
                at,
                at);
    }

    private static EtlExecutionSummary execution(UUID runId, int gestion, int periodo) {
        Instant at = Instant.parse("2026-11-01T00:00:00Z");
        return new EtlExecutionSummary(
                runId,
                EtlExecutionKind.CIERRE_ACADEMICO,
                EtlExecutionStatus.FALLIDA,
                5L,
                gestion,
                periodo,
                "hop",
                at,
                at,
                at);
    }

    private QueryAcademicClosurePort closurePort() {
        return new QueryAcademicClosurePort() {
            @Override
            public Optional<AcademicPeriodClosure> findById(long closureId) {
                return Optional.ofNullable(closures.get(closureId));
            }

            @Override
            public ClosurePage<AcademicPeriodClosureEvent> loadEvents(long closureId, int page, int size) {
                throw new UnsupportedOperationException();
            }
        };
    }

    private QueryEtlExecutionsPort executionPort() {
        return new QueryEtlExecutionsPort() {
            @Override
            public ExecutionPage<EtlExecutionSummary> find(EtlExecutionSearchCriteria criteria, int page, int size) {
                throw new UnsupportedOperationException();
            }

            @Override
            public Optional<EtlExecutionSummary> findSummary(UUID runId) {
                return Optional.ofNullable(executions.get(runId));
            }

            @Override
            public List<EtlExecutionStep> findSteps(UUID runId) {
                return List.of();
            }

            @Override
            public List<EtlExecutionMetric> findMetrics(UUID runId) {
                return List.of();
            }

            @Override
            public List<EtlExecutionError> findSanitizedErrorMetadata(UUID runId) {
                return List.of();
            }
        };
    }
}
