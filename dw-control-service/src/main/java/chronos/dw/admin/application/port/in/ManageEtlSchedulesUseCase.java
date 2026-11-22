package chronos.dw.admin.application.port.in;

import chronos.dw.admin.domain.model.EtlSchedule;
import chronos.dw.admin.domain.model.EtlScheduleDefinition;
import chronos.dw.admin.domain.model.ScheduleOccurrence;
import java.util.List;

public interface ManageEtlSchedulesUseCase {

    List<EtlSchedule> list();

    EtlSchedule get(long scheduleId);

    EtlSchedule create(EtlScheduleDefinition definition, String actor);

    EtlSchedule update(long scheduleId, int expectedRowVersion, EtlScheduleDefinition definition, String actor);

    EtlSchedule setEnabled(long scheduleId, int expectedRowVersion, boolean enabled, String actor);

    EtlSchedule delete(long scheduleId, int expectedRowVersion, String actor);

    /** Next occurrences of a cron expression, flagged against the DSA operating window. Does not validate. */
    List<ScheduleOccurrence> preview(String cronExpression, String timezone, int count);
}
