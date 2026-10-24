package chronos.dw.admin.application.port.in;

import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import java.time.Instant;

public interface CloseAcademicPeriodUseCase {

    AcademicPeriodClosure close(long closureId, Instant effectiveAt, String actorSubject, String reason);
}
