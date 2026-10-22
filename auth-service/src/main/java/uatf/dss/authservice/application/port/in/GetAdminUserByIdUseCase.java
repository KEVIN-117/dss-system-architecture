package uatf.dss.authservice.application.port.in;

import java.util.UUID;

public interface GetAdminUserByIdUseCase {
    AdminUserDirectoryEntry execute(UUID userId);
}
