package chronos.dw.admin.domain.exception;

import chronos.dw.admin.domain.model.ClosureStatus;

public class InvalidClosureTransitionException extends RuntimeException {

    public InvalidClosureTransitionException(ClosureStatus current, ClosureStatus target) {
        super("Transition not allowed: " + current + " -> " + target);
    }
}
