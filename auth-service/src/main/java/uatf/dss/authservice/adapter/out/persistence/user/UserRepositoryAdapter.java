package uatf.dss.authservice.adapter.out.persistence.user;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import uatf.dss.authservice.adapter.out.persistence.role.RoleEntity;
import uatf.dss.authservice.adapter.out.persistence.role.SpringDataRoleRepository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.exception.notfound.RoleNotFoundException;
import uatf.dss.authservice.domain.model.User;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Repository
public class UserRepositoryAdapter implements UserRepository {

    private final SpringDataUserRepository springDataRepository;
    private final SpringDataRoleRepository springDataRoleRepository;
    private final UserPersistenceMapper mapper;

    public UserRepositoryAdapter(
            SpringDataUserRepository springDataRepository,
            SpringDataRoleRepository springDataRoleRepository,
            UserPersistenceMapper mapper) {
        this.springDataRepository = springDataRepository;
        this.springDataRoleRepository = springDataRoleRepository;
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
    public List<String> findRoleNamesByUserId(UUID id) {
        return springDataRepository.findRoleNamesByUserId(id);
    }

    @Override
    @Transactional
    public void replaceRoleSnapshot(UUID userId, Set<String> roleNames) {
        UserEntity user = springDataRepository.findById(userId).orElseThrow(UserNotFoundException::new);
        Set<String> requestedNames = roleNames == null ? Set.of() : Set.copyOf(roleNames);
        Set<RoleEntity> resolvedRoles = requestedNames.isEmpty()
                ? new HashSet<>()
                : new HashSet<>(springDataRoleRepository.findAllByNameIn(requestedNames));
        Set<String> resolvedNames = resolvedRoles.stream()
                .map(RoleEntity::getName)
                .collect(Collectors.toSet());
        if (!resolvedNames.equals(requestedNames)) {
            throw new RoleNotFoundException();
        }
        user.setRoles(resolvedRoles);
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
