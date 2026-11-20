package uatf.dss.authservice.application.port.in;

public interface ListAdminAuditUseCase {
    AdminAuditPage execute(ListAdminAuditQuery query);
}
