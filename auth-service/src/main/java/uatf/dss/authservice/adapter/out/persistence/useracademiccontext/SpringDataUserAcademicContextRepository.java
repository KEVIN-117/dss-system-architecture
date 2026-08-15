package uatf.dss.authservice.adapter.out.persistence.useracademiccontext;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;


public interface SpringDataUserAcademicContextRepository extends JpaRepository<UserAcademicContextEntity, UUID> {

    Optional<UserAcademicContextEntity> findByUserId(UUID userId);
}
