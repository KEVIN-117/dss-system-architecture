package chronos.dw.admin.application.port.in;

import chronos.dw.admin.domain.model.AcademicPeriodClosure;

public interface CreateAcademicClosureUseCase {

    AcademicPeriodClosure create(int gestion, int periodo, String actorSubject, String reason);
}
