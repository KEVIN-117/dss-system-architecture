package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.Optional;
import java.util.UUID;

public interface AcademicContextRepository {
    Optional<UserAcademicContext> findByUserId(UUID userId);
    UserAcademicContext save(UserAcademicContext context);
    Optional<UserAcademicContext> delete(UUID id);
}
