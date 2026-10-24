package chronos.dw.admin.application.port.in;

import chronos.dw.admin.domain.model.EtlExecutionDetail;
import java.util.UUID;

public interface GetEtlExecutionUseCase {

    EtlExecutionDetail get(UUID runId);
}
