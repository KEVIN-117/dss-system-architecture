package uatf.dss.authservice.application.service;

import uatf.dss.authservice.application.port.in.AdminAuditPage;
import uatf.dss.authservice.application.port.in.ListAdminAuditQuery;
import uatf.dss.authservice.application.port.in.ListAdminAuditUseCase;
import uatf.dss.authservice.application.port.out.AdminAuditLogRepository;
import uatf.dss.authservice.domain.exception.validation.ValidationException;

public class ListAdminAuditService implements ListAdminAuditUseCase {

    private final AdminAuditLogRepository repository;

    public ListAdminAuditService(AdminAuditLogRepository repository) {
        this.repository = repository;
    }

    @Override
    public AdminAuditPage execute(ListAdminAuditQuery query) {
        if (query.from() != null && query.to() != null && !query.from().isBefore(query.to())) {
            throw new ValidationException("El inicio del rango de fechas debe ser anterior al final.");
        }
        return repository.search(query);
    }
}
