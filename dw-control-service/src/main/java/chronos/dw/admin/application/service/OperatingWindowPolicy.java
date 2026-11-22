package chronos.dw.admin.application.service;

import chronos.dw.admin.configuration.EtlProperties;
import chronos.dw.admin.domain.exception.InvalidEtlScheduleException;
import chronos.dw.admin.domain.model.ScheduleOccurrence;
import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

/**
 * DSA operating window (Lun–Vie 08:00–18:00 America/La_Paz by default): scheduled DW updates must run outside it.
 * Also parses and checks cron expressions so the API and the scheduler share the same rules.
 */
@Component
public class OperatingWindowPolicy {

    private static final Locale ES = Locale.forLanguageTag("es-BO");
    private static final Pattern SIX_FIELDS = Pattern.compile("^\\S+( \\S+){5}$");
    private static final DateTimeFormatter OCCURRENCE_FORMAT = DateTimeFormatter.ofPattern("EEEE dd/MM/yyyy HH:mm", ES);

    private final Set<DayOfWeek> days;
    private final LocalTime start;
    private final LocalTime end;
    private final ZoneId zone;
    private final Duration minInterval;
    private final int validationOccurrences;

    public OperatingWindowPolicy(EtlProperties properties) {
        EtlProperties.OperatingWindow window = properties.operatingWindow();
        this.days = window.daySet();
        this.start = window.start();
        this.end = window.end();
        this.zone = window.zone();
        this.minInterval = properties.scheduler().minInterval();
        this.validationOccurrences = properties.scheduler().validationOccurrences();
    }

    public ZoneId zone() {
        return zone;
    }

    /** Human description, for example {@code lunes a viernes 08:00–18:00 (America/La_Paz)}. */
    public String describe() {
        String dayText = days.stream()
                .sorted()
                .map(day -> day.getDisplayName(TextStyle.FULL, ES))
                .collect(Collectors.joining(", "));
        return dayText + " " + start + "–" + end + " (" + zone.getId() + ")";
    }

    public boolean isWithin(Instant instant) {
        ZonedDateTime local = instant.atZone(zone);
        LocalTime time = local.toLocalTime();
        return days.contains(local.getDayOfWeek()) && !time.isBefore(start) && time.isBefore(end);
    }

    public CronExpression parseCron(String cronExpression) {
        String trimmed = cronExpression == null ? "" : cronExpression.trim();
        if (!SIX_FIELDS.matcher(trimmed).matches()) {
            throw new InvalidEtlScheduleException(
                    "La expresión cron debe tener seis campos: segundo minuto hora día mes día-de-semana");
        }
        try {
            return CronExpression.parse(trimmed);
        } catch (IllegalArgumentException exception) {
            throw new InvalidEtlScheduleException("La expresión cron no es válida: " + exception.getMessage());
        }
    }

    public ZoneId parseZone(String timezone) {
        if (timezone == null || timezone.isBlank()) {
            return zone;
        }
        try {
            return ZoneId.of(timezone.trim());
        } catch (DateTimeException exception) {
            throw new InvalidEtlScheduleException("La zona horaria " + timezone + " no es válida");
        }
    }

    /** Next fire strictly after {@code from}, or {@code null} if the expression never fires again. */
    public Instant nextFire(CronExpression cron, ZoneId scheduleZone, Instant from) {
        ZonedDateTime next = cron.next(from.atZone(scheduleZone));
        return next == null ? null : next.toInstant();
    }

    public List<ScheduleOccurrence> occurrences(CronExpression cron, ZoneId scheduleZone, Instant from, int count) {
        List<ScheduleOccurrence> result = new ArrayList<>(count);
        ZonedDateTime cursor = from.atZone(scheduleZone);
        for (int index = 0; index < count; index++) {
            cursor = cron.next(cursor);
            if (cursor == null) {
                break;
            }
            Instant at = cursor.toInstant();
            result.add(new ScheduleOccurrence(at, isWithin(at)));
        }
        return result;
    }

    /**
     * Rejects schedules that never fire, fire more often than {@code app.etl.scheduler.min-interval} or have one of
     * their next occurrences inside the operating window.
     */
    public void validate(CronExpression cron, ZoneId scheduleZone, Instant from) {
        List<ScheduleOccurrence> next = occurrences(cron, scheduleZone, from, validationOccurrences);
        if (next.isEmpty()) {
            throw new InvalidEtlScheduleException("La expresión cron no produce ejecuciones futuras");
        }
        for (int index = 0; index < next.size(); index++) {
            ScheduleOccurrence occurrence = next.get(index);
            if (occurrence.insideOperatingWindow()) {
                throw new InvalidEtlScheduleException("La ejecución del "
                        + OCCURRENCE_FORMAT.format(occurrence.at().atZone(zone))
                        + " cae dentro del horario operativo de la DSA (" + describe() + ")");
            }
            if (index > 0
                    && Duration.between(next.get(index - 1).at(), occurrence.at())
                                    .compareTo(minInterval)
                            < 0) {
                throw new InvalidEtlScheduleException(
                        "La programación se ejecuta con demasiada frecuencia; el intervalo mínimo es de "
                                + minInterval.toMinutes() + " minutos");
            }
        }
    }
}
