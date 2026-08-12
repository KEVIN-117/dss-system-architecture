package uatf.dss.authservice.adapter.out.persistence.exampleuser;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

interface SpringDataExampleUserRepository extends JpaRepository<ExampleUserEntity, String> {
    Optional<ExampleUserEntity> findByEmail(String email);
}
