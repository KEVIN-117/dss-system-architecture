package chronos.dw.admin.application.port.out;

import chronos.dw.admin.application.model.ClosurePage;
import chronos.dw.admin.domain.model.AcademicClosureSearchCriteria;
import chronos.dw.admin.domain.model.AcademicPeriodClosure;

public interface LoadAcademicClosuresPort {

    ClosurePage<AcademicPeriodClosure> load(AcademicClosureSearchCriteria criteria, int page, int size);
}
