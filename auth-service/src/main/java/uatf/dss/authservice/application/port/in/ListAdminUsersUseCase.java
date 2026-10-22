package uatf.dss.authservice.application.port.in;

public interface ListAdminUsersUseCase {
    AdminUserDirectoryPage execute(ListAdminUsersQuery query);
}
