package uatf.dss.authservice.application;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uatf.dss.authservice.application.port.in.GetUserAcademicScopeCommand;
import uatf.dss.authservice.application.port.in.UserAcademicScope;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.application.service.GetUserAcademicScopeService;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GetUserAcademicScopeServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AcademicContextRepository contextRepository;

    @InjectMocks
    private GetUserAcademicScopeService service;

    private static User user(UUID id, UUID keycloakId, boolean active) {
        return User.create(id, keycloakId, "decano.fac3", "decano.fac3@uatf.edu.bo", "Ana", "Pérez", active);
    }

    @Test
    void returnsNormalizedRolesAndContextsForDean() {
        UUID keycloakId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.of(user(userId, keycloakId, true)));
        when(userRepository.findRoleNamesByUserId(userId))
                .thenReturn(Arrays.asList("ROLE_DECANO", " decano ", "DIRECTOR", null, " "));
        when(contextRepository.findAllByUserId(userId))
                .thenReturn(List.of(new UserAcademicContext(UUID.randomUUID(), userId, 3, null)));

        UserAcademicScope scope = service.execute(new GetUserAcademicScopeCommand(keycloakId));

        assertEquals(keycloakId, scope.keycloakId());
        assertTrue(scope.active());
        assertEquals(List.of("DECANO", "DIRECTOR"), scope.roles());
        assertEquals(List.of(new UserAcademicScope.Context(3, null)), scope.contexts());
    }

    @Test
    void reportsInactiveUsersSoCallersCanDeny() {
        UUID keycloakId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.of(user(userId, keycloakId, false)));
        when(userRepository.findRoleNamesByUserId(userId)).thenReturn(List.of("DIRECTOR"));
        when(contextRepository.findAllByUserId(userId))
                .thenReturn(List.of(new UserAcademicContext(UUID.randomUUID(), userId, 3, "ABC")));

        UserAcademicScope scope = service.execute(new GetUserAcademicScopeCommand(keycloakId));

        assertFalse(scope.active());
        assertEquals(List.of(new UserAcademicScope.Context(3, "ABC")), scope.contexts());
    }

    @Test
    void rectorHasNoContexts() {
        UUID keycloakId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.of(user(userId, keycloakId, true)));
        when(userRepository.findRoleNamesByUserId(userId)).thenReturn(List.of("RECTOR", "DECANO", "DIRECTOR"));
        when(contextRepository.findAllByUserId(userId)).thenReturn(List.of());

        UserAcademicScope scope = service.execute(new GetUserAcademicScopeCommand(keycloakId));

        assertEquals(List.of("DECANO", "DIRECTOR", "RECTOR"), scope.roles());
        assertTrue(scope.contexts().isEmpty());
    }

    @Test
    void unknownUserIsNotFoundAndNoContextsAreRead() {
        UUID keycloakId = UUID.randomUUID();
        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class,
                () -> service.execute(new GetUserAcademicScopeCommand(keycloakId)));
        verify(contextRepository, never()).findAllByUserId(any());
    }
}
