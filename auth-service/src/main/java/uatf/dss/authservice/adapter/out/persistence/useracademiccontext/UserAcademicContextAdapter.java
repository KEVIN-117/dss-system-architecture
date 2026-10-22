package uatf.dss.authservice.adapter.out.persistence.useracademiccontext;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Repository;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Collection;
import java.util.Map;
import java.util.stream.Collectors;

@Repository
public class UserAcademicContextAdapter implements AcademicContextRepository {
    private final SpringDataUserAcademicContextRepository academicContextRepository;
    private final AcademicContextMapper mapper;

    public UserAcademicContextAdapter(SpringDataUserAcademicContextRepository academicContextRepository, AcademicContextMapper mapper){
        this.academicContextRepository = academicContextRepository;
        this.mapper = mapper;
    }

    @Override
    public Optional<UserAcademicContext> findByUserId(UUID userId) {
        return academicContextRepository.findByUserId(userId).map(mapper::toDomain);
    }

    @Override
    public List<UserAcademicContext> findAllByUserId(UUID userId) {
        return academicContextRepository.findAllByUserId(userId).stream().map(mapper::toDomain).toList();
    }

    @Override
    public Map<UUID, List<UserAcademicContext>> findAllByUserIds(Collection<UUID> userIds) {
        if (userIds.isEmpty()) return Map.of();
        return academicContextRepository.findAllByUserIdIn(List.copyOf(userIds)).stream()
                .map(mapper::toDomain)
                .collect(Collectors.groupingBy(UserAcademicContext::userId));
    }

    @Override
    public UserAcademicContext save(UserAcademicContext context) {
        UserAcademicContextEntity entity = mapper.toEntity(context);
        UserAcademicContextEntity savedEntity = academicContextRepository.save(entity);
        return mapper.toDomain(savedEntity);
    }

    @Override
    @Transactional
    public List<UserAcademicContext> replaceAllForUser(UUID userId, List<UserAcademicContext> contexts) {
        academicContextRepository.deleteAllByUserId(userId);
        List<UserAcademicContextEntity> entities = contexts.stream().map(mapper::toEntity).toList();
        return academicContextRepository.saveAll(entities).stream().map(mapper::toDomain).toList();
    }

    @Override
    public Optional<UserAcademicContext> delete(UUID id) {
        return academicContextRepository.findById(id)
                .map(entity -> {
                    academicContextRepository.delete(entity);
                    return mapper.toDomain(entity);
                });
    }
}
