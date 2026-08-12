package uatf.dss.authservice.adapter.out.persistence.exampleuser;

import org.springframework.stereotype.Repository;
import uatf.dss.authservice.application.port.out.ExampleUserRepository;
import uatf.dss.authservice.domain.model.ExampleUser;
import java.util.Optional;

@Repository
class ExampleUserRepositoryAdapter implements ExampleUserRepository {

    private final SpringDataExampleUserRepository springDataRepository;
    private final ExampleUserPersistenceMapper mapper;

    public ExampleUserRepositoryAdapter(SpringDataExampleUserRepository springDataRepository, ExampleUserPersistenceMapper mapper) {
        this.springDataRepository = springDataRepository;
        this.mapper = mapper;
    }

    @Override
    public Optional<ExampleUser> findByEmail(String email) {
        return springDataRepository.findByEmail(email)
                .map(mapper::toDomain);
    }

    @Override
    public ExampleUser save(ExampleUser user) {
        ExampleUserEntity entity = mapper.toEntity(user);
        ExampleUserEntity savedEntity = springDataRepository.save(entity);
        return mapper.toDomain(savedEntity);
    }
}
