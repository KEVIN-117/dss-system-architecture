package uatf.dss.authservice.application;

import org.junit.jupiter.api.Test;
import uatf.dss.authservice.application.port.in.ListAdminUsersQuery;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.application.port.out.UserDirectorySearchResult;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.application.service.AdminUserDirectoryService;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.model.Email;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminUserDirectoryServiceTest {

    private final UserRepository users = org.mockito.Mockito.mock(UserRepository.class);
    private final AcademicContextRepository contexts = org.mockito.Mockito.mock(AcademicContextRepository.class);
    private final AdminUserDirectoryService service = new AdminUserDirectoryService(users, contexts);

    @Test
    void listsUsersWithRolesContextsAndPaginationMetadata() {
        UUID id = UUID.randomUUID();
        User user = user(id);
        var academicContext = new UserAcademicContext(UUID.randomUUID(), id, 4, "INF");
        when(users.searchDirectory("ana", true, "DECANO", 4, "INF", 2, 10))
                .thenReturn(new UserDirectorySearchResult(List.of(user), 25, 3));
        when(users.findRoleNamesByUserIds(List.of(id))).thenReturn(java.util.Map.of(id, List.of("DECANO", "ANALYST")));
        when(contexts.findAllByUserIds(List.of(id))).thenReturn(java.util.Map.of(id, List.of(academicContext)));

        var result = service.execute(new ListAdminUsersQuery("ana", true, "DECANO", 4, "INF", 2, 10));

        assertEquals(2, result.page());
        assertEquals(10, result.size());
        assertEquals(25, result.totalElements());
        assertEquals(3, result.totalPages());
        assertEquals(List.of("ANALYST", "DECANO"), result.content().getFirst().roles());
        assertEquals(List.of(academicContext), result.content().getFirst().academicContexts());
    }

    @Test
    void returnsUserDetailByLocalId() {
        UUID id = UUID.randomUUID();
        when(users.findById(id)).thenReturn(Optional.of(user(id)));
        when(users.findRoleNamesByUserId(id)).thenReturn(List.of("SUPERADMIN"));
        when(contexts.findAllByUserId(id)).thenReturn(List.of());

        var result = service.execute(id);

        assertEquals(id, result.id());
        assertEquals("ana", result.username());
        assertEquals(List.of("SUPERADMIN"), result.roles());
    }

    @Test
    void missingUserDetailThrowsNotFound() {
        UUID id = UUID.randomUUID();
        when(users.findById(id)).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.execute(id));
        verify(contexts, org.mockito.Mockito.never()).findAllByUserId(id);
    }

    private static User user(UUID id) {
        return new User(id, UUID.randomUUID(), "ana", new Email("ana@uatf.edu.bo"), "Ana", "Flores", true);
    }
}
