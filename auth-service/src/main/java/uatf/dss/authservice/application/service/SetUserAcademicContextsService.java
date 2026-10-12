package uatf.dss.authservice.application.service;

import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsCommand;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsUseCase;
import uatf.dss.authservice.application.port.out.AcademicCatalogRepository;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.exception.conflict.UserRoleSnapshotNotFoundException;
import uatf.dss.authservice.domain.exception.notfound.CareerNotFoundException;
import uatf.dss.authservice.domain.exception.notfound.FacultyNotFoundException;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.exception.validation.InvalidAcademicContextException;
import uatf.dss.authservice.domain.model.RoleType;
import uatf.dss.authservice.domain.model.UserAcademicContext;
import uatf.dss.authservice.domain.validator.AcademicContextValidator;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static net.logstash.logback.argument.StructuredArguments.kv;

public class SetUserAcademicContextsService implements SetUserAcademicContextsUseCase {

    private static final Logger AUDIT_LOGGER = LoggerFactory.getLogger("AUDIT_LOGGER");
    private static final Map<RoleType, Integer> ROLE_PRECEDENCE = Map.of(
            RoleType.DIRECTOR, 1,
            RoleType.DECANO, 2,
            RoleType.RECTOR, 3,
            RoleType.SUPERADMIN, 4);

    private final UserRepository userRepository;
    private final AcademicContextRepository contextRepository;
    private final AcademicCatalogRepository catalogRepository;

    public SetUserAcademicContextsService(
            UserRepository userRepository,
            AcademicContextRepository contextRepository,
            AcademicCatalogRepository catalogRepository) {
        this.userRepository = userRepository;
        this.contextRepository = contextRepository;
        this.catalogRepository = catalogRepository;
    }

    @Override
    @Transactional
    public List<UserAcademicContext> execute(SetUserAcademicContextsCommand command) {
        userRepository.findById(command.targetUserId()).orElseThrow(UserNotFoundException::new);

        // The local roles are a Keycloak audit/read-model snapshot, never the authority for this endpoint.
        // @PreAuthorize on the controller authorizes the actor directly from the JWT.
        Set<RoleType> effectiveRoles = userRepository.findRoleNamesByUserId(command.targetUserId()).stream()
                .map(SetUserAcademicContextsService::toRoleType)
                .filter(role -> role != null)
                .collect(Collectors.toSet());
        RoleType targetRole = effectiveRoles.stream()
                .max(Comparator.comparingInt(ROLE_PRECEDENCE::get))
                .orElseThrow(UserRoleSnapshotNotFoundException::new);

        validateContextCount(targetRole, command.contexts().size());

        List<UserAcademicContext> requestedContexts = command.contexts().stream()
                .map(input -> new UserAcademicContext(
                        null,
                        command.targetUserId(),
                        input.facultyId(),
                        input.careerId()))
                .toList();

        requestedContexts.forEach(context -> AcademicContextValidator.validate(context, targetRole));
        validateCatalogReferences(requestedContexts);

        List<UserAcademicContext> saved = contextRepository.replaceAllForUser(command.targetUserId(), requestedContexts);
        AUDIT_LOGGER.info("Contexto académico de usuario actualizado",
                kv("event_type", "USER_ACADEMIC_CONTEXTS_REPLACED"),
                kv("actor_keycloak_id", command.actorKeycloakId()),
                kv("target_user_id", command.targetUserId()),
                kv("target_role", targetRole.name()),
                kv("context_count", saved.size()));
        return saved;
    }

    private void validateCatalogReferences(List<UserAcademicContext> contexts) {
        for (UserAcademicContext context : contexts) {
            if (context.facultyId() != null && !catalogRepository.existsActiveFaculty(context.facultyId())) {
                throw new FacultyNotFoundException();
            }
            if (context.careerId() != null
                    && !catalogRepository.existsActiveProgram(context.careerId(), context.facultyId())) {
                throw new CareerNotFoundException();
            }
        }
    }

    private void validateContextCount(RoleType role, int count) {
        int expected = switch (role) {
            case SUPERADMIN, RECTOR -> 0;
            case DECANO, DIRECTOR -> 1;
        };
        if (count != expected) {
            throw new InvalidAcademicContextException(
                    "Role " + role + " requires exactly " + expected + " academic context(s).");
        }
    }

    private static RoleType toRoleType(String roleName) {
        if (roleName == null) {
            return null;
        }
        String normalized = roleName.trim().toUpperCase(Locale.ROOT);
        if (normalized.startsWith("ROLE_")) {
            normalized = normalized.substring("ROLE_".length());
        }
        try {
            return RoleType.valueOf(normalized);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
