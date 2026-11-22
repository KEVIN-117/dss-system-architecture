package chronos.dw.admin.domain.model;

/**
 * User input to create or edit a schedule. The process cannot change after creation.
 *
 * @param timezone IANA zone of the cron expression; {@code null} means the DSA operating-window zone
 */
public record EtlScheduleDefinition(
        String processCode, String name, String cronExpression, String timezone, boolean enabled) {}
