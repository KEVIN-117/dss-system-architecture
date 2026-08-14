package uatf.dss.authservice.application.port.in;

import uatf.dss.authservice.domain.model.User;

public interface SyncUserUseCase {
    User sync(SyncUserCommand command);
}
