package chronos.dw.admin.application.port.in;

import chronos.dw.admin.domain.model.ClosureStatus;

public interface ValidateClosureTransitionUseCase {
    ClosureStatus validate(ClosureStatus current, ClosureStatus target);
}
