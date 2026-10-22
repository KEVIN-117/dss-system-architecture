package chronos.dw.admin.application.service;

import chronos.dw.admin.application.port.in.ValidateClosureTransitionUseCase;
import chronos.dw.admin.domain.exception.InvalidClosureTransitionException;
import chronos.dw.admin.domain.model.ClosureStatus;
import java.util.Objects;
import org.springframework.stereotype.Service;

/** Application-level entry point for validating an allowed closure lifecycle transition. */
@Service
public class ClosureTransitionPolicy implements ValidateClosureTransitionUseCase {

    @Override
    public ClosureStatus validate(ClosureStatus current, ClosureStatus target) {
        Objects.requireNonNull(current, "current status is required");
        Objects.requireNonNull(target, "target status is required");
        if (!current.canTransitionTo(target)) {
            throw new InvalidClosureTransitionException(current, target);
        }
        return target;
    }
}
