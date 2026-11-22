package chronos.dw.admin.application.port.in;

public interface FireDueEtlSchedulesUseCase {

    /**
     * Fires the schedules that are due and claimed by this instance.
     *
     * @return number of fires recorded (launched or skipped)
     */
    int fireDueSchedules();
}
