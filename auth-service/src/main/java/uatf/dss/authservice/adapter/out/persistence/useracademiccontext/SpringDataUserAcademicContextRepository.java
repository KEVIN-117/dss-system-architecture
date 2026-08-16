package uatf.dss.authservice.adapter.out.persistence.useracademiccontext;

import org.springframework.data.jpa.repository.JpaRepository;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;
import java.util.Optional;
import java.util.UUID;


public interface SpringDataUserAcademicContextRepository extends JpaRepository<UserAcademicContextEntity, UUID> {

    Optional<UserAcademicContextEntity> findByUserId(UUID userId);

    List<UserAcademicContext> findAllByUserId(UUID userId);
}
