package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.ExampleUser;
import java.util.Optional;

public interface ExampleUserRepository {
    Optional<ExampleUser> findByEmail(String email);
    ExampleUser save(ExampleUser user);
}
