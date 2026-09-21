package uatf.dss.authservice.adapter.out.persistence.user;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.model.User;
import java.util.Optional;
import java.util.UUID;

@Repository
public class UserRepositoryAdapter implements UserRepository {

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
    @Transactional
    public User save(User user) {
        if (user.id() == null) {
            return mapper.toDomain(springDataRepository.save(mapper.toEntity(user)));
        }

        return springDataRepository.findById(user.id())
                .map(existingEntity -> {
                    mapper.updateEntity(user, existingEntity);
                    return mapper.toDomain(existingEntity);
                })
                .orElseGet(() -> mapper.toDomain(springDataRepository.save(mapper.toEntity(user))));
    }

    @Override
    public Optional<User> findById(UUID id) {
        return springDataRepository.findById(id).map(mapper::toDomain);
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return springDataRepository.findByEmail(email).map(mapper::toDomain);
    }

    @Override
    public void delete(UUID id) {
        UserEntity entity = springDataRepository.findById(id).orElseThrow(UserNotFoundException::new);
        entity.setActive(false);
        springDataRepository.save(entity);
    }

    @Override
    public boolean existsByEmail(String email) {
        return springDataRepository.existsByEmail(email);
    }
}
