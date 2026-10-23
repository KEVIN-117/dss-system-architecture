package chronos.dw.admin.application.service;

import chronos.dw.admin.application.port.in.GetAcademicClosureUseCase;
import chronos.dw.admin.application.port.out.QueryAcademicClosurePort;
import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class GetAcademicClosureService implements GetAcademicClosureUseCase {

    private final QueryAcademicClosurePort queryAcademicClosurePort;

    public GetAcademicClosureService(QueryAcademicClosurePort queryAcademicClosurePort) {
        this.queryAcademicClosurePort = queryAcademicClosurePort;
    }

    @Override
    public Optional<AcademicPeriodClosure> findById(long closureId) {
        return queryAcademicClosurePort.findById(closureId);
    }
}
