package chronos.dw.admin.application.service;

import chronos.dw.admin.application.model.ClosurePage;
import chronos.dw.admin.application.port.in.ListAcademicClosuresUseCase;
import chronos.dw.admin.application.port.out.LoadAcademicClosuresPort;
import chronos.dw.admin.domain.model.AcademicClosureSearchCriteria;
import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import java.util.Objects;
import org.springframework.stereotype.Service;

@Service
public class ListAcademicClosuresService implements ListAcademicClosuresUseCase {

    private final LoadAcademicClosuresPort loadAcademicClosuresPort;

    public ListAcademicClosuresService(LoadAcademicClosuresPort loadAcademicClosuresPort) {
        this.loadAcademicClosuresPort = Objects.requireNonNull(loadAcademicClosuresPort);
    }

    @Override
    public ClosurePage<AcademicPeriodClosure> list(AcademicClosureSearchCriteria criteria, int page, int size) {
        return loadAcademicClosuresPort.load(criteria, page, size);
    }
}
