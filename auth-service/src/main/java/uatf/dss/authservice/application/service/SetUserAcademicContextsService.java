package uatf.dss.authservice.application.service;

import jakarta.transaction.Transactional;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsCommand;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsUseCase;
import uatf.dss.authservice.application.port.out.AcademicCatalogRepository;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.exception.notfound.CareerNotFoundException;
import uatf.dss.authservice.domain.exception.notfound.FacultyNotFoundException;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.model.AcademicScope;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.UserAcademicContext;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;
import uatf.dss.authservice.domain.validator.AcademicContextValidator;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;


public class SetUserAcademicContextsService implements SetUserAcademicContextsUseCase {

    static final String AUDIT_ACTION = "USER_ACADEMIC_CONTEXTS_REPLACED";

    private final UserRepository userRepository;
    private final AcademicContextRepository contextRepository;
    private final AcademicCatalogRepository catalogRepository;
    private final AdminAuditRecorder auditRecorder;
    private final AcademicScopeResolver scopeResolver;

    public SetUserAcademicContextsService(
            UserRepository userRepository,
            AcademicContextRepository contextRepository,
            AcademicCatalogRepository catalogRepository,
            AdminAuditRecorder auditRecorder,
            AcademicScopeResolver scopeResolver) {
        this.userRepository = userRepository;
        this.contextRepository = contextRepository;
        this.catalogRepository = catalogRepository;
        this.auditRecorder = auditRecorder;
        this.scopeResolver = scopeResolver;
    }

    @Override
    @Transactional
    public List<UserAcademicContext> execute(SetUserAcademicContextsCommand command) {
        AdminAuditRecorder.Operation operation = new AdminAuditRecorder.Operation(
                command.actor(),
                AUDIT_ACTION,
                AuditTargetType.USER,
                command.targetUserId().toString(),
                () -> snapshot(contextRepository.findAllByUserId(command.targetUserId())));
        return auditRecorder.recordLocal(operation, () -> replace(command), SetUserAcademicContextsService::snapshot);
    }

    private List<UserAcademicContext> replace(SetUserAcademicContextsCommand command) {
        User target = userRepository.findById(command.targetUserId()).orElseThrow(UserNotFoundException::new);

        // The scope comes from the user's effective permissions read live from Keycloak, never from role names or the
        // local snapshot. @PreAuthorize on the controller authorizes the actor directly from the JWT.
        AcademicScope scope = scopeResolver.resolve(target.keycloakId().toString());

        List<UserAcademicContext> requestedContexts = command.contexts().stream()
                .map(input -> new UserAcademicContext(
                        null,
                        command.targetUserId(),
                        input.facultyId(),
                        input.careerId()))
                .toList();

        // Count (0 for GLOBAL/NONE, 1..N for FACULTY/CAREER), shape per scope and no duplicates (IAM-009).
        AcademicContextValidator.validateAll(requestedContexts, scope);
        validateCatalogReferences(requestedContexts);

        return contextRepository.replaceAllForUser(command.targetUserId(), requestedContexts);
    }

    /** Audit snapshot: only the academic scope, no personal data. */
    private static Map<String, Object> snapshot(List<UserAcademicContext> contexts) {
        List<Map<String, Object>> items = contexts.stream()
                .map(context -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("facultyId", context.facultyId());
                    item.put("careerId", context.careerId());
                    return item;
                })
                .toList();
        return Map.of("academicContexts", items);
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
}
