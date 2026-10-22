package chronos.dw.admin.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import chronos.dw.admin.domain.exception.InvalidClosureTransitionException;
import chronos.dw.admin.domain.model.ClosureStatus;
import org.junit.jupiter.api.Test;

class ClosureTransitionPolicyTest {

    private final ClosureTransitionPolicy policy = new ClosureTransitionPolicy();

    @Test
    void allowsEveryConfiguredTransition() {
        assertEquals(ClosureStatus.CERRADO, policy.validate(ClosureStatus.PENDIENTE, ClosureStatus.CERRADO));
        assertEquals(ClosureStatus.PROCESADO, policy.validate(ClosureStatus.CERRADO, ClosureStatus.PROCESADO));
        assertEquals(ClosureStatus.REABIERTO, policy.validate(ClosureStatus.CERRADO, ClosureStatus.REABIERTO));
        assertEquals(ClosureStatus.CERRADO, policy.validate(ClosureStatus.REABIERTO, ClosureStatus.CERRADO));
        assertEquals(ClosureStatus.REABIERTO, policy.validate(ClosureStatus.PROCESADO, ClosureStatus.REABIERTO));
    }

    @Test
    void rejectsTransitionsOutsideTheLifecycle() {
        assertThrows(
                InvalidClosureTransitionException.class,
                () -> policy.validate(ClosureStatus.PENDIENTE, ClosureStatus.PROCESADO));
        assertThrows(
                InvalidClosureTransitionException.class,
                () -> policy.validate(ClosureStatus.PROCESADO, ClosureStatus.CERRADO));
    }
}
