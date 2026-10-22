package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Collection;
import java.util.Map;

public interface AcademicContextRepository {
    Optional<UserAcademicContext> findByUserId(UUID userId);
    List<UserAcademicContext> findAllByUserId(UUID userId);
    Map<UUID, List<UserAcademicContext>> findAllByUserIds(Collection<UUID> userIds);
    UserAcademicContext save(UserAcademicContext context);
    List<UserAcademicContext> replaceAllForUser(UUID userId, List<UserAcademicContext> contexts);
    Optional<UserAcademicContext> delete(UUID id);
}
