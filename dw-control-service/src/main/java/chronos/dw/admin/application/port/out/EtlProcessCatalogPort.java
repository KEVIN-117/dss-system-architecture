package chronos.dw.admin.application.port.out;

import chronos.dw.admin.domain.model.EtlProcess;
import java.util.List;
import java.util.Optional;

public interface EtlProcessCatalogPort {

    List<EtlProcess> findAll();

    Optional<EtlProcess> findByCode(String processCode);
}
