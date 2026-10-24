package chronos.dw.admin.application.port.in;

import chronos.dw.admin.domain.model.AcademicPeriodClosure;

public interface ReopenAcademicPeriodUseCase {

    AcademicPeriodClosure reopen(long closureId, String actorSubject, String reason);
}
