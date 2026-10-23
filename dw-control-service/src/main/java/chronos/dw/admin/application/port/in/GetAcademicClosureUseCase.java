package chronos.dw.admin.application.port.in;

import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import java.util.Optional;

public interface GetAcademicClosureUseCase {

    Optional<AcademicPeriodClosure> findById(long closureId);
}
