package chronos.dw.admin.application.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import chronos.dw.admin.configuration.EtlProperties;
import chronos.dw.admin.domain.exception.InvalidEtlScheduleException;
import chronos.dw.admin.domain.model.ScheduleOccurrence;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;

class OperatingWindowPolicyTest {

    /** Monday 2026-11-23 02:00 in La Paz (UTC-4). */
    private static final Instant MONDAY_0200 = Instant.parse("2026-11-23T06:00:00Z");

    private static final ZoneId LA_PAZ = ZoneId.of("America/La_Paz");

    private final OperatingWindowPolicy policy = new OperatingWindowPolicy(new EtlProperties(null, null, null));

    @Test
    void defaultWindowIsMondayToFridayEightToSixInLaPaz() {
        assertTrue(policy.isWithin(Instant.parse("2026-11-23T12:00:00Z")), "lunes 08:00");
        assertTrue(policy.isWithin(Instant.parse("2026-11-27T21:59:00Z")), "viernes 17:59");
        assertFalse(policy.isWithin(Instant.parse("2026-11-23T11:59:00Z")), "lunes 07:59");
        assertFalse(policy.isWithin(Instant.parse("2026-11-23T22:00:00Z")), "lunes 18:00");
        assertFalse(policy.isWithin(Instant.parse("2026-11-28T14:00:00Z")), "sábado 10:00");
        assertTrue(policy.describe().contains("08:00–18:00 (America/La_Paz)"));
    }

    @Test
    void rejectsSchedulesThatRunDuringDsaHours() {
        InvalidEtlScheduleException exception = assertThrows(
                InvalidEtlScheduleException.class,
                () -> policy.validate(policy.parseCron("0 0 10 * * *"), LA_PAZ, MONDAY_0200));
        assertTrue(exception.getMessage().contains("horario operativo de la DSA"), exception.getMessage());
    }

    @Test
    void acceptsNightlyAndWeekendSchedules() {
        assertDoesNotThrow(() -> policy.validate(policy.parseCron("0 0 2 * * *"), LA_PAZ, MONDAY_0200));
        assertDoesNotThrow(() -> policy.validate(policy.parseCron("0 30 10 * * SAT,SUN"), LA_PAZ, MONDAY_0200));
        assertDoesNotThrow(() -> policy.validate(policy.parseCron("0 0 20 * * MON-FRI"), LA_PAZ, MONDAY_0200));
    }

    @Test
    void evaluatesTheCronInItsOwnZoneAndTheWindowInLaPaz() {
        ZoneId utc = ZoneId.of("UTC");
        // 13:00 UTC is 09:00 in La Paz: inside the window.
        assertThrows(
                InvalidEtlScheduleException.class,
                () -> policy.validate(policy.parseCron("0 0 13 * * MON-FRI"), utc, MONDAY_0200));
        // 06:00 UTC is 02:00 in La Paz: outside.
        assertDoesNotThrow(() -> policy.validate(policy.parseCron("0 0 6 * * *"), utc, MONDAY_0200));
    }

    @Test
    void rejectsTooFrequentInvalidAndNeverFiringExpressions() {
        InvalidEtlScheduleException frequent = assertThrows(
                InvalidEtlScheduleException.class,
                () -> policy.validate(policy.parseCron("0 */10 0-5 * * *"), LA_PAZ, MONDAY_0200));
        assertTrue(frequent.getMessage().contains("60 minutos"), frequent.getMessage());

        assertThrows(InvalidEtlScheduleException.class, () -> policy.parseCron("0 2 * * *"));
        assertThrows(InvalidEtlScheduleException.class, () -> policy.parseCron("@daily"));
        assertThrows(InvalidEtlScheduleException.class, () -> policy.parseCron("0 0 25 * * *"));
        assertThrows(
                InvalidEtlScheduleException.class,
                () -> policy.validate(policy.parseCron("0 0 2 31 2 *"), LA_PAZ, MONDAY_0200));
        assertThrows(InvalidEtlScheduleException.class, () -> policy.parseZone("Marte/Olympus"));
        assertEquals(LA_PAZ, policy.parseZone(null));
    }

    @Test
    void previewFlagsOccurrencesInsideTheWindow() {
        List<ScheduleOccurrence> occurrences =
                policy.occurrences(policy.parseCron("0 0 7,9 * * MON"), LA_PAZ, MONDAY_0200, 2);

        assertEquals(Instant.parse("2026-11-23T11:00:00Z"), occurrences.get(0).at());
        assertFalse(occurrences.get(0).insideOperatingWindow());
        assertEquals(Instant.parse("2026-11-23T13:00:00Z"), occurrences.get(1).at());
        assertTrue(occurrences.get(1).insideOperatingWindow());
    }

    @Test
    void windowIsConfigurable() {
        OperatingWindowPolicy custom = new OperatingWindowPolicy(new EtlProperties(
                null,
                null,
                new EtlProperties.OperatingWindow(
                        List.of(java.time.DayOfWeek.SATURDAY),
                        java.time.LocalTime.of(7, 0),
                        java.time.LocalTime.of(20, 0),
                        LA_PAZ),
                null,
                null));

        assertTrue(custom.isWithin(Instant.parse("2026-11-28T14:00:00Z")), "sábado 10:00");
        assertFalse(custom.isWithin(Instant.parse("2026-11-23T14:00:00Z")), "lunes 10:00");
    }
}
