package chronos.dw.admin.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import chronos.dw.admin.application.port.in.LaunchEtlProcessUseCase;
import chronos.dw.admin.configuration.EtlProperties;
import chronos.dw.admin.domain.exception.EtlLaunchConflictException;
import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import chronos.dw.admin.domain.model.ClosureStatus;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import chronos.dw.admin.domain.model.EtlLaunchTrigger;
import chronos.dw.admin.domain.model.EtlSchedule;
import chronos.dw.admin.domain.model.LaunchEtlCommand;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ScheduledFireServiceTest {

    /** Monday 2026-11-23 02:00 in La Paz. */
    private static final Instant NIGHT = Instant.parse("2026-11-23T06:00:00Z");
    /** Monday 2026-11-23 10:00 in La Paz. */
    private static final Instant OFFICE_HOURS = Instant.parse("2026-11-23T14:00:00Z");

    private static final UUID SKIP_ID = UUID.fromString("55555555-5555-4555-8555-555555555555");

    private final List<LaunchEtlCommand> commands = new ArrayList<>();
    private RuntimeException launchFailure;
    private Optional<AcademicPeriodClosure> pendingClosure = Optional.empty();

    @Test
    void withoutPendingClosuresTheFireIsRecordedAsSkipped() {
        Fixture fixture = fixture(NIGHT);
        EtlSchedule schedule = fixture.schedules.put(due("VERTICAL_LOAD", EtlSchedule.MODE_AUTO_PENDING_CLOSURES));

        assertEquals(1, fixture.service.fireDueSchedules());

        EtlLaunch skipped = fixture.launches.rows.get(SKIP_ID);
        assertEquals(EtlLaunchStatus.SKIPPED, skipped.status());
        assertEquals("No hay cierres académicos CERRADO pendientes de procesar", skipped.resultSummary());
        assertTrue(commands.isEmpty());
        // Fire closed with the skipped launch and the next nightly occurrence (Tuesday 02:00 La Paz).
        assertEquals(List.of(schedule.id() + ":" + SKIP_ID + ":2026-11-24T06:00:00Z"), fixture.schedules.completed);
        assertNull(fixture.schedules.rows.get(schedule.id()).claimToken());
    }

    @Test
    void pendingClosureIsLoadedAsAScheduledLaunch() {
        pendingClosure = Optional.of(closure(12L));
        Fixture fixture = fixture(NIGHT);
        EtlSchedule schedule = fixture.schedules.put(due("VERTICAL_LOAD", EtlSchedule.MODE_AUTO_PENDING_CLOSURES));

        fixture.service.fireDueSchedules();

        assertEquals(1, commands.size());
        LaunchEtlCommand command = commands.get(0);
        assertEquals("VERTICAL_LOAD", command.processCode());
        assertEquals(12L, command.closureId());
        assertEquals(schedule.id(), command.scheduleId());
        assertEquals("scheduler:Carga nocturna", command.actor());
        assertTrue(fixture.schedules.completed.get(0).contains(":2026-11-24T06:00:00Z"));
    }

    @Test
    void noParameterProcessIsLaunchedDirectly() {
        Fixture fixture = fixture(NIGHT);
        fixture.schedules.put(due("CATALOG_SYNC", EtlSchedule.MODE_NO_PARAMETERS));

        fixture.service.fireDueSchedules();

        assertEquals("CATALOG_SYNC", commands.get(0).processCode());
    }

    @Test
    void activeLaunchMakesTheFireSkipped() {
        pendingClosure = Optional.of(closure(12L));
        launchFailure = new EtlLaunchConflictException("Ya existe una ejecución activa");
        Fixture fixture = fixture(NIGHT);
        fixture.schedules.put(due("VERTICAL_LOAD", EtlSchedule.MODE_AUTO_PENDING_CLOSURES));

        fixture.service.fireDueSchedules();

        assertEquals(
                "Ya hay una ejecución activa del proceso VERTICAL_LOAD",
                fixture.launches.rows.get(SKIP_ID).resultSummary());
    }

    @Test
    void fireInsideDsaHoursIsSkippedEvenIfTheScheduleIsDue() {
        pendingClosure = Optional.of(closure(12L));
        Fixture fixture = fixture(OFFICE_HOURS);
        fixture.schedules.put(due("VERTICAL_LOAD", EtlSchedule.MODE_AUTO_PENDING_CLOSURES));

        fixture.service.fireDueSchedules();

        assertTrue(commands.isEmpty());
        assertTrue(fixture.launches.rows.get(SKIP_ID).resultSummary().contains("horario operativo de la DSA"));
    }

    @Test
    void nothingDueNothingFired() {
        Fixture fixture = fixture(NIGHT);
        EtlSchedule future = due("CATALOG_SYNC", EtlSchedule.MODE_NO_PARAMETERS);
        fixture.schedules.put(new EtlSchedule(
                future.id(),
                future.processCode(),
                future.name(),
                future.cronExpression(),
                future.timezone(),
                future.mode(),
                true,
                NIGHT.plusSeconds(3600),
                null,
                null,
                null,
                null,
                "admin",
                NIGHT,
                "admin",
                NIGHT,
                null,
                1));

        assertEquals(0, fixture.service.fireDueSchedules());
    }

    private Fixture fixture(Instant now) {
        Clock clock = Clock.fixed(now, ZoneOffset.UTC);
        ScheduleFakes.Schedules schedules = new ScheduleFakes.Schedules(clock);
        LoadManagerFakes.Launches launches = new LoadManagerFakes.Launches(clock);
        LaunchEtlProcessUseCase launcher = command -> {
            commands.add(command);
            if (launchFailure != null) {
                throw launchFailure;
            }
            return new EtlLaunch(
                    UUID.randomUUID(),
                    command.processCode(),
                    EtlLaunchTrigger.SCHEDULED,
                    command.scheduleId(),
                    command.closureId(),
                    null,
                    Map.of(),
                    EtlLaunchStatus.SUBMITTED,
                    UUID.randomUUID(),
                    command.actor(),
                    now,
                    now,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    2);
        };
        ScheduledFireService service = new ScheduledFireService(
                schedules,
                launches,
                launcher,
                () -> pendingClosure,
                new OperatingWindowPolicy(new EtlProperties(null, null, null)),
                new EtlProperties(null, null, null),
                clock,
                () -> SKIP_ID);
        return new Fixture(schedules, launches, service);
    }

    private static EtlSchedule due(String processCode, String mode) {
        return new EtlSchedule(
                7L,
                processCode,
                "Carga nocturna",
                "0 0 2 * * *",
                "America/La_Paz",
                mode,
                true,
                NIGHT.minusSeconds(1),
                null,
                null,
                null,
                null,
                "admin",
                NIGHT,
                "admin",
                NIGHT,
                null,
                1);
    }

    private static AcademicPeriodClosure closure(long id) {
        Instant at = Instant.parse("2026-11-01T00:00:00Z");
        return new AcademicPeriodClosure(
                id, 2026, 2, ClosureStatus.CERRADO, at, "dsa:test", "dsa:test", "Fixture", 1, null, null, at, at);
    }

    private record Fixture(
            ScheduleFakes.Schedules schedules, LoadManagerFakes.Launches launches, ScheduledFireService service) {}
}
