package chronos.dw.admin.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import chronos.dw.admin.configuration.EtlProperties;
import chronos.dw.admin.domain.exception.EtlProcessNotFoundException;
import chronos.dw.admin.domain.exception.EtlScheduleConflictException;
import chronos.dw.admin.domain.exception.EtlScheduleNotFoundException;
import chronos.dw.admin.domain.exception.InvalidEtlScheduleException;
import chronos.dw.admin.domain.model.EtlSchedule;
import chronos.dw.admin.domain.model.EtlScheduleDefinition;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ScheduleServiceTest {

    /** Monday 2026-11-23 02:00 in La Paz. */
    private static final Instant NOW = Instant.parse("2026-11-23T06:00:00Z");

    private ScheduleFakes.Schedules schedules;
    private ScheduleService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        schedules = new ScheduleFakes.Schedules(clock);
        service = new ScheduleService(
                schedules,
                new LoadManagerFakes.Catalog(
                        LoadManagerFakes.vertical(),
                        LoadManagerFakes.catalogSync(true),
                        LoadManagerFakes.publishStaged()),
                new OperatingWindowPolicy(new EtlProperties(null, null, null)),
                clock);
    }

    @Test
    void nightlyScheduleIsAcceptedWithItsNextFire() {
        EtlSchedule created = service.create(
                new EtlScheduleDefinition("VERTICAL_LOAD", "  Carga nocturna  ", " 0 0 2 * * * ", null, true),
                "admin:test");

        assertEquals("Carga nocturna", created.name());
        assertEquals("0 0 2 * * *", created.cronExpression());
        assertEquals("America/La_Paz", created.timezone());
        // 02:00 already passed at 02:00:00; next is Tuesday 02:00 La Paz.
        assertEquals(Instant.parse("2026-11-24T06:00:00Z"), created.nextFireAt());
    }

    @Test
    void scheduleDuringDsaHoursIsRejected() {
        InvalidEtlScheduleException exception = assertThrows(
                InvalidEtlScheduleException.class,
                () -> service.create(
                        new EtlScheduleDefinition("VERTICAL_LOAD", "Mañana", "0 0 10 * * MON", null, true),
                        "admin:test"));

        assertTrue(exception.getMessage().contains("horario operativo"), exception.getMessage());
        assertTrue(schedules.rows.isEmpty());
    }

    @Test
    void manualOnlyAndUnknownProcessesCannotBeScheduled() {
        assertThrows(
                InvalidEtlScheduleException.class,
                () -> service.create(
                        new EtlScheduleDefinition("PUBLISH_STAGED", "x", "0 0 2 * * *", null, true), "admin:test"));
        assertThrows(
                EtlProcessNotFoundException.class,
                () -> service.create(new EtlScheduleDefinition("NOPE", "x", "0 0 2 * * *", null, true), "admin"));
        assertThrows(
                InvalidEtlScheduleException.class,
                () -> service.create(
                        new EtlScheduleDefinition("CATALOG_SYNC", " ", "0 0 2 * * *", null, true), "admin:test"));
    }

    @Test
    void disabledScheduleHasNoNextFireUntilEnabledAgain() {
        EtlSchedule created = service.create(
                new EtlScheduleDefinition("CATALOG_SYNC", "Catálogo", "0 0 3 * * SUN", "America/La_Paz", false),
                "admin:test");
        assertFalse(created.enabled());
        assertNull(created.nextFireAt());

        EtlSchedule enabled = service.setEnabled(created.id(), created.rowVersion(), true, "admin:test");

        assertTrue(enabled.enabled());
        assertEquals(Instant.parse("2026-11-29T07:00:00Z"), enabled.nextFireAt());
    }

    @Test
    void updateRevalidatesAndKeepsTheProcess() {
        EtlSchedule created = service.create(
                new EtlScheduleDefinition("VERTICAL_LOAD", "Carga", "0 0 2 * * *", null, true), "admin:test");

        assertThrows(
                InvalidEtlScheduleException.class,
                () -> service.update(
                        created.id(),
                        created.rowVersion(),
                        new EtlScheduleDefinition("VERTICAL_LOAD", "Carga", "0 0 12 * * *", null, true),
                        "admin:test"));
        assertThrows(
                InvalidEtlScheduleException.class,
                () -> service.update(
                        created.id(),
                        created.rowVersion(),
                        new EtlScheduleDefinition("CATALOG_SYNC", "Carga", "0 0 2 * * *", null, true),
                        "admin:test"));
        assertThrows(
                EtlScheduleConflictException.class,
                () -> service.update(
                        created.id(),
                        99,
                        new EtlScheduleDefinition(null, "Carga", "0 0 4 * * *", null, true),
                        "admin:test"));

        EtlSchedule updated = service.update(
                created.id(),
                created.rowVersion(),
                new EtlScheduleDefinition(null, "Carga 04h", "0 0 4 * * *", null, true),
                "admin:test");
        assertEquals(Instant.parse("2026-11-23T08:00:00Z"), updated.nextFireAt());
        assertThrows(EtlScheduleNotFoundException.class, () -> service.get(404L));
    }

    @Test
    void previewIsBoundedAndDoesNotValidate() {
        var occurrences = service.preview("0 0 9 * * *", null, 500);

        assertEquals(ScheduleService.MAX_PREVIEW, occurrences.size());
        assertTrue(occurrences.stream().anyMatch(occurrence -> occurrence.insideOperatingWindow()));
    }
}
