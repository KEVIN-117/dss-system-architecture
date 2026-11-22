package chronos.dw.admin.application.port.out;

import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import java.util.Optional;

public interface FindPendingClosurePort {

    /** Oldest closure in status CERRADO, that is, closed by DSA and not yet PROCESADO. */
    Optional<AcademicPeriodClosure> findOldestClosedPendingProcessing();
}
