package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AcademicContextRepository {
    Optional<UserAcademicContext> findByUserId(UUID userId);
    List<UserAcademicContext> findAllByUserId(UUID userId);
    UserAcademicContext save(UserAcademicContext context);
    Optional<UserAcademicContext> delete(UUID id);
}
