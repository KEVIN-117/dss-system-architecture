package chronos.dw.admin.application.service;

import chronos.dw.admin.application.model.ClosurePage;
import chronos.dw.admin.application.port.in.ListAcademicClosureEventsUseCase;
import chronos.dw.admin.application.port.out.QueryAcademicClosurePort;
import chronos.dw.admin.domain.model.AcademicPeriodClosureEvent;
import org.springframework.stereotype.Service;

@Service
public class ListAcademicClosureEventsService implements ListAcademicClosureEventsUseCase {

    private final QueryAcademicClosurePort queryAcademicClosurePort;

    public ListAcademicClosureEventsService(QueryAcademicClosurePort queryAcademicClosurePort) {
        this.queryAcademicClosurePort = queryAcademicClosurePort;
    }

    @Override
    public ClosurePage<AcademicPeriodClosureEvent> list(long closureId, int page, int size) {
        return queryAcademicClosurePort.loadEvents(closureId, page, size);
    }
}
