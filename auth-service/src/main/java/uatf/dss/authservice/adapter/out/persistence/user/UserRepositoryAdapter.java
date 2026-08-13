package uatf.dss.authservice.adapter.out.persistence.user;

import org.springframework.stereotype.Repository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.model.User;
import java.util.Optional;
import java.util.UUID;

@Repository
class UserRepositoryAdapter implements UserRepository {

    private final SpringDataUserRepository springDataRepository;
    private final UserPersistenceMapper mapper;

    public UserRepositoryAdapter(SpringDataUserRepository springDataRepository, UserPersistenceMapper mapper) {
        this.springDataRepository = springDataRepository;
        this.mapper = mapper;
    }

    @Override
    public Optional<User> findByKeycloakId(UUID keycloakId) {
        return springDataRepository.findByKeycloakId(keycloakId)
                .map(mapper::toDomain);
    }

    @Override
    public User save(User user) {
        UserEntity entity = mapper.toEntity(user);
        UserEntity savedEntity = springDataRepository.save(entity);
        return mapper.toDomain(savedEntity);
    }
}
