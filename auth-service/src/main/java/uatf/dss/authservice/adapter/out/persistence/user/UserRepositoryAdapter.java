package uatf.dss.authservice.adapter.out.persistence.user;

import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
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
import jakarta.persistence.criteria.JoinType;
import java.util.Collection;
import java.util.Map;

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
    public Map<UUID, List<String>> findRoleNamesByUserIds(Collection<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        return springDataRepository.findRoleNamesByUserIds(List.copyOf(ids)).stream()
                .collect(Collectors.groupingBy(row -> (UUID) row[0],
                        Collectors.mapping(row -> (String) row[1], Collectors.toList())));
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

    @Override
    public uatf.dss.authservice.application.port.out.UserDirectorySearchResult searchDirectory(
            String query, Boolean active, String role, Integer facultyId, String careerId, int page, int size) {
        Specification<UserEntity> specification = (root, criteriaQuery, builder) -> builder.conjunction();
        if (query != null && !query.isBlank()) {
            String pattern = "%" + query.trim().toLowerCase(java.util.Locale.ROOT) + "%";
            specification = specification.and((root, criteriaQuery, builder) -> builder.or(
                    builder.like(builder.lower(root.<String>get("username")), pattern),
                    builder.like(builder.lower(root.<String>get("email")), pattern),
                    builder.like(builder.lower(root.<String>get("firstName")), pattern),
                    builder.like(builder.lower(root.<String>get("lastName")), pattern)));
        }
        if (active != null) {
            specification = specification.and((root, criteriaQuery, builder) -> builder.equal(root.get("active"), active));
        }
        if (role != null && !role.isBlank()) {
            specification = specification.and((root, criteriaQuery, builder) -> {
                var roles = root.join("roles", JoinType.INNER);
                criteriaQuery.distinct(true);
                return builder.equal(builder.upper(roles.<String>get("name")), role.trim().toUpperCase(java.util.Locale.ROOT));
            });
        }
        if (facultyId != null || (careerId != null && !careerId.isBlank())) {
            specification = specification.and((root, criteriaQuery, builder) -> {
                var contexts = root.join("academicContexts", JoinType.INNER);
                criteriaQuery.distinct(true);
                var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
                if (facultyId != null) predicates.add(builder.equal(contexts.get("facultyId"), facultyId));
                if (careerId != null && !careerId.isBlank()) {
                    predicates.add(builder.equal(builder.trim(contexts.<String>get("careerId")), careerId.trim()));
                }
                return builder.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
            });
        }
        Page<UserEntity> result = springDataRepository.findAll(specification,
                PageRequest.of(page, size, Sort.by(Sort.Order.asc("username"), Sort.Order.asc("id"))));
        return new uatf.dss.authservice.application.port.out.UserDirectorySearchResult(
                result.getContent().stream().map(mapper::toDomain).toList(), result.getTotalElements(), result.getTotalPages());
    }
}
