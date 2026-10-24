package chronos.dw.admin.application.service;

import chronos.dw.admin.application.port.in.CloseAcademicPeriodUseCase;
import chronos.dw.admin.application.port.in.CreateAcademicClosureUseCase;
import chronos.dw.admin.application.port.in.ReopenAcademicPeriodUseCase;
import chronos.dw.admin.application.port.in.ValidateClosureTransitionUseCase;
import chronos.dw.admin.application.port.out.ManageAcademicClosuresPort;
import chronos.dw.admin.application.port.out.QueryAcademicClosurePort;
import chronos.dw.admin.domain.exception.AcademicClosureNotFoundException;
import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import chronos.dw.admin.domain.model.ClosureStatus;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ManageAcademicClosuresService
        implements CreateAcademicClosureUseCase, CloseAcademicPeriodUseCase, ReopenAcademicPeriodUseCase {

    private final ManageAcademicClosuresPort manageClosures;
    private final QueryAcademicClosurePort queryClosures;
    private final ValidateClosureTransitionUseCase transitionPolicy;

    public ManageAcademicClosuresService(
            ManageAcademicClosuresPort manageClosures,
            QueryAcademicClosurePort queryClosures,
            ValidateClosureTransitionUseCase transitionPolicy) {
        this.manageClosures = manageClosures;
        this.queryClosures = queryClosures;
        this.transitionPolicy = transitionPolicy;
    }

    @Override
    @Transactional
    public AcademicPeriodClosure create(int gestion, int periodo, String actorSubject, String reason) {
        return manageClosures.create(gestion, periodo, actorSubject, reason);
    }

    @Override
    @Transactional
    public AcademicPeriodClosure close(long closureId, Instant effectiveAt, String actorSubject, String reason) {
        AcademicPeriodClosure current = getCurrent(closureId);
        transitionPolicy.validate(current.status(), ClosureStatus.CERRADO);
        return manageClosures.transition(closureId, ClosureStatus.CERRADO, actorSubject, reason, effectiveAt);
    }

    @Override
    @Transactional
    public AcademicPeriodClosure reopen(long closureId, String actorSubject, String reason) {
        AcademicPeriodClosure current = getCurrent(closureId);
        transitionPolicy.validate(current.status(), ClosureStatus.REABIERTO);
        return manageClosures.transition(closureId, ClosureStatus.REABIERTO, actorSubject, reason, null);
    }

    private AcademicPeriodClosure getCurrent(long closureId) {
        return queryClosures.findById(closureId).orElseThrow(() -> new AcademicClosureNotFoundException(closureId));
    }
}
