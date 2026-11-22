package chronos.dw.admin.application.service;

import chronos.dw.admin.application.port.in.ManageEtlSchedulesUseCase;
import chronos.dw.admin.application.port.out.EtlProcessCatalogPort;
import chronos.dw.admin.application.port.out.EtlSchedulePort;
import chronos.dw.admin.domain.exception.EtlProcessNotFoundException;
import chronos.dw.admin.domain.exception.EtlScheduleNotFoundException;
import chronos.dw.admin.domain.exception.InvalidEtlScheduleException;
import chronos.dw.admin.domain.model.EtlProcess;
import chronos.dw.admin.domain.model.EtlSchedule;
import chronos.dw.admin.domain.model.EtlScheduleDefinition;
import chronos.dw.admin.domain.model.ScheduleOccurrence;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;

/**
 * Administration of Load Manager schedules. Every definition is validated against the DSA operating window before
 * it is stored, and {@code next_fire_at} is always computed here (the database does not evaluate cron).
 */
@Service
public class ScheduleService implements ManageEtlSchedulesUseCase {

    static final int MAX_PREVIEW = 50;

    private final EtlSchedulePort schedules;
    private final EtlProcessCatalogPort catalog;
    private final OperatingWindowPolicy policy;
    private final Clock clock;

    public ScheduleService(
            EtlSchedulePort schedules, EtlProcessCatalogPort catalog, OperatingWindowPolicy policy, Clock clock) {
        this.schedules = schedules;
        this.catalog = catalog;
        this.policy = policy;
        this.clock = clock;
    }

    @Override
    public List<EtlSchedule> list() {
        return schedules.findAll();
    }

    @Override
    public EtlSchedule get(long scheduleId) {
        return schedules.findById(scheduleId).orElseThrow(() -> new EtlScheduleNotFoundException(scheduleId));
    }

    @Override
    public EtlSchedule create(EtlScheduleDefinition definition, String actor) {
        EtlProcess process = catalog.findByCode(definition.processCode())
                .orElseThrow(() -> new EtlProcessNotFoundException(definition.processCode()));
        if (!process.schedulable()) {
            throw new InvalidEtlScheduleException("El proceso " + process.code() + " no admite programaciones");
        }
        ValidSchedule valid = validate(definition.cronExpression(), definition.timezone());
        return schedules.create(
                process.code(),
                requireName(definition.name()),
                valid.cronExpression(),
                valid.zone().getId(),
                definition.enabled() ? valid.nextFireAt() : null,
                definition.enabled(),
                actor);
    }

    @Override
    public EtlSchedule update(long scheduleId, int expectedRowVersion, EtlScheduleDefinition definition, String actor) {
        EtlSchedule current = get(scheduleId);
        if (definition.processCode() != null && !definition.processCode().equals(current.processCode())) {
            throw new InvalidEtlScheduleException("El proceso de una programación no se puede cambiar");
        }
        ValidSchedule valid = validate(definition.cronExpression(), definition.timezone());
        return schedules.update(
                scheduleId,
                expectedRowVersion,
                requireName(definition.name()),
                valid.cronExpression(),
                valid.zone().getId(),
                current.enabled() ? valid.nextFireAt() : null,
                actor);
    }

    @Override
    public EtlSchedule setEnabled(long scheduleId, int expectedRowVersion, boolean enabled, String actor) {
        EtlSchedule current = get(scheduleId);
        Instant nextFireAt = null;
        if (enabled) {
            // Re-validated: the operating window may have changed since the schedule was created.
            nextFireAt = validate(current.cronExpression(), current.timezone()).nextFireAt();
        }
        return schedules.setEnabled(scheduleId, expectedRowVersion, enabled, nextFireAt, actor);
    }

    @Override
    public EtlSchedule delete(long scheduleId, int expectedRowVersion, String actor) {
        return schedules.delete(scheduleId, expectedRowVersion, actor);
    }

    @Override
    public List<ScheduleOccurrence> preview(String cronExpression, String timezone, int count) {
        CronExpression cron = policy.parseCron(cronExpression);
        ZoneId zone = policy.parseZone(timezone);
        return policy.occurrences(cron, zone, clock.instant(), Math.max(1, Math.min(count, MAX_PREVIEW)));
    }

    @Override
    public Optional<String> validationError(String cronExpression, String timezone) {
        try {
            validate(cronExpression, timezone);
            return Optional.empty();
        } catch (InvalidEtlScheduleException exception) {
            return Optional.of(exception.getMessage());
        }
    }

    private ValidSchedule validate(String cronExpression, String timezone) {
        CronExpression cron = policy.parseCron(cronExpression);
        ZoneId zone = policy.parseZone(timezone);
        Instant now = clock.instant();
        policy.validate(cron, zone, now);
        return new ValidSchedule(cronExpression.trim(), zone, policy.nextFire(cron, zone, now));
    }

    private static String requireName(String name) {
        if (name == null || name.isBlank() || name.trim().length() > 120) {
            throw new InvalidEtlScheduleException(
                    "El nombre de la programación es obligatorio (máximo 120 caracteres)");
        }
        return name.trim();
    }

    private record ValidSchedule(String cronExpression, ZoneId zone, Instant nextFireAt) {}
}
