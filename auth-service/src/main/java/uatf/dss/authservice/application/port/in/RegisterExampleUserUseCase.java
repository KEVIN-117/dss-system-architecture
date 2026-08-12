package uatf.dss.authservice.application.port.in;

import uatf.dss.authservice.domain.model.ExampleUser;

public interface RegisterExampleUserUseCase {
    ExampleUser register(RegisterExampleUserCommand command);
}
