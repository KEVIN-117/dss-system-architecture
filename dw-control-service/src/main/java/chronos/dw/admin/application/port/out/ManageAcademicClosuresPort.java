package chronos.dw.admin.application.port.out;

import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import chronos.dw.admin.domain.model.ClosureStatus;
import java.time.Instant;

public interface ManageAcademicClosuresPort {

    AcademicPeriodClosure create(int gestion, int periodo, String actorSubject, String reason);

    AcademicPeriodClosure transition(
            long closureId, ClosureStatus target, String actorSubject, String reason, Instant effectiveAt);
}
