package chronos.dw.admin.application.port.in;

import chronos.dw.admin.application.model.ClosurePage;
import chronos.dw.admin.domain.model.AcademicClosureSearchCriteria;
import chronos.dw.admin.domain.model.AcademicPeriodClosure;

public interface ListAcademicClosuresUseCase {

    ClosurePage<AcademicPeriodClosure> list(AcademicClosureSearchCriteria criteria, int page, int size);
}
