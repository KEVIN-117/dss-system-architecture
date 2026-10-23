package chronos.dw.admin.application.port.out;

import chronos.dw.admin.application.model.ClosurePage;
import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import chronos.dw.admin.domain.model.AcademicPeriodClosureEvent;
import java.util.Optional;

public interface QueryAcademicClosurePort {

    Optional<AcademicPeriodClosure> findById(long closureId);

    ClosurePage<AcademicPeriodClosureEvent> loadEvents(long closureId, int page, int size);
}
