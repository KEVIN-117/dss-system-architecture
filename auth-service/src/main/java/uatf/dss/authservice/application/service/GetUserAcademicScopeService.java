package uatf.dss.authservice.application.service;

import uatf.dss.authservice.application.port.in.GetUserAcademicScopeCommand;
import uatf.dss.authservice.application.port.in.GetUserAcademicScopeUseCase;
import uatf.dss.authservice.application.port.in.UserAcademicScope;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.model.User;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Resolves a user's analytics scope for service-to-service callers (olap-service backstop).
 *
 * <p>Unknown users raise {@link UserNotFoundException} (404) so the caller denies; this service
 * never invents a default scope.
 */
public class GetUserAcademicScopeService implements GetUserAcademicScopeUseCase {

    private static final String ROLE_PREFIX = "ROLE_";

    private final UserRepository userRepository;
    private final AcademicContextRepository contextRepository;

    public GetUserAcademicScopeService(UserRepository userRepository, AcademicContextRepository contextRepository) {
        this.userRepository = userRepository;
        this.contextRepository = contextRepository;
    }

    @Override
    public UserAcademicScope execute(GetUserAcademicScopeCommand command) {
        User user = userRepository.findByKeycloakId(command.keycloakId()).orElseThrow(UserNotFoundException::new);

        List<String> roles = userRepository.findRoleNamesByUserId(user.id()).stream()
                .filter(Objects::nonNull)
                .map(GetUserAcademicScopeService::normalizeRole)
                .filter(role -> !role.isEmpty())
                .distinct()
                .sorted()
                .toList();

        List<UserAcademicScope.Context> contexts = contextRepository.findAllByUserId(user.id()).stream()
                .map(context -> new UserAcademicScope.Context(context.facultyId(), context.careerId()))
                .toList();

        return new UserAcademicScope(user.keycloakId(), user.isActive(), roles, contexts);
    }

    private static String normalizeRole(String roleName) {
        String normalized = roleName.trim().toUpperCase(Locale.ROOT);
        return normalized.startsWith(ROLE_PREFIX) ? normalized.substring(ROLE_PREFIX.length()) : normalized;
    }
}
