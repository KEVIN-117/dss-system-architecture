package chronos.dw.admin.domain.model;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/** Domain lifecycle for an academic period closure, aligned with etl_control. */
public enum ClosureStatus {
    PENDIENTE,
    CERRADO,
    REABIERTO,
    PROCESADO;

    private static final Map<ClosureStatus, Set<ClosureStatus>> ALLOWED_TRANSITIONS = Map.of(
            PENDIENTE, EnumSet.of(CERRADO),
            CERRADO, EnumSet.of(PROCESADO, REABIERTO),
            REABIERTO, EnumSet.of(CERRADO),
            PROCESADO, EnumSet.of(REABIERTO));

    public boolean canTransitionTo(ClosureStatus target) {
        return target != null && ALLOWED_TRANSITIONS.get(this).contains(target);
    }
}
