package uatf.dss.authservice.application.service;

import uatf.dss.authservice.application.port.in.AdminUserDirectoryEntry;
import uatf.dss.authservice.application.port.in.AdminUserDirectoryPage;
import uatf.dss.authservice.application.port.in.GetAdminUserByIdUseCase;
import uatf.dss.authservice.application.port.in.ListAdminUsersQuery;
import uatf.dss.authservice.application.port.in.ListAdminUsersUseCase;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;
import java.util.UUID;

public class AdminUserDirectoryService implements ListAdminUsersUseCase, GetAdminUserByIdUseCase {

    private final UserRepository userRepository;
    private final AcademicContextRepository contextRepository;

    public AdminUserDirectoryService(UserRepository userRepository, AcademicContextRepository contextRepository) {
        this.userRepository = userRepository;
        this.contextRepository = contextRepository;
    }

    @Override
    public AdminUserDirectoryPage execute(ListAdminUsersQuery query) {
        var users = userRepository.searchDirectory(
                query.query(), query.active(), query.role(), query.facultyId(), query.careerId(), query.page(), query.size());
        List<UUID> ids = users.users().stream().map(User::id).toList();
        var rolesByUser = userRepository.findRoleNamesByUserIds(ids);
        var contextsByUser = contextRepository.findAllByUserIds(ids);
        List<AdminUserDirectoryEntry> content = users.users().stream()
                .map(user -> toEntry(user, rolesByUser.getOrDefault(user.id(), List.of()), contextsByUser.getOrDefault(user.id(), List.of())))
                .toList();
        return new AdminUserDirectoryPage(content, query.page(), query.size(), users.totalElements(), users.totalPages());
    }

    @Override
    public AdminUserDirectoryEntry execute(UUID userId) {
        User user = userRepository.findById(userId).orElseThrow(UserNotFoundException::new);
        return toEntry(user, userRepository.findRoleNamesByUserId(userId), contextRepository.findAllByUserId(userId));
    }

    private AdminUserDirectoryEntry toEntry(User user, List<String> roles, List<UserAcademicContext> academicContexts) {
        List<String> sortedRoles = roles.stream().sorted().toList();
        var contexts = academicContexts.stream()
                .sorted(java.util.Comparator.comparing((UserAcademicContext context) -> context.facultyId() == null ? 0 : context.facultyId())
                        .thenComparing(context -> context.careerId() == null ? "" : context.careerId()))
                .toList();
        return new AdminUserDirectoryEntry(user.id(), user.username(), user.email().email(), user.firstName(), user.lastName(),
                user.isActive(), sortedRoles, contexts);
    }
}
