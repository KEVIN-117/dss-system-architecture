package uatf.dss.authservice.adapter.out.persistence.useracademiccontext;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface SpringDataUserAcademicContextRepository extends JpaRepository<UserAcademicContextEntity, UUID> {

    List<UserAcademicContextEntity> findAllByUserId(UUID userId);
    List<UserAcademicContextEntity> findAllByUserIdIn(List<UUID> userIds);

    void deleteAllByUserId(UUID userId);
}
