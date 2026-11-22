package chronos.dw.admin.domain.model;

/** Optional filters of the launch history; {@code null} means "any". */
public record EtlLaunchSearchCriteria(
        String processCode, EtlLaunchStatus status, EtlLaunchTrigger trigger, Long scheduleId) {

    public static EtlLaunchSearchCriteria none() {
        return new EtlLaunchSearchCriteria(null, null, null, null);
    }
}
