package chronos.dw.admin.application.port.in;

import chronos.dw.admin.application.model.ClosurePage;
import chronos.dw.admin.domain.model.AcademicPeriodClosureEvent;

public interface ListAcademicClosureEventsUseCase {

    ClosurePage<AcademicPeriodClosureEvent> list(long closureId, int page, int size);
}
