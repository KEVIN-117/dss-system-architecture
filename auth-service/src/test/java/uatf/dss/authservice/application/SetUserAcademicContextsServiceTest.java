package uatf.dss.authservice.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsCommand;
import uatf.dss.authservice.application.port.out.AcademicCatalogRepository;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.application.service.SetUserAcademicContextsService;
import uatf.dss.authservice.domain.exception.conflict.UserRoleSnapshotNotFoundException;
import uatf.dss.authservice.domain.exception.notfound.CareerNotFoundException;
import uatf.dss.authservice.domain.exception.validation.InvalidAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidDeanAcademicContextException;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SetUserAcademicContextsServiceTest {

    @Mock UserRepository userRepository;
    @Mock AcademicContextRepository contextRepository;
    @Mock AcademicCatalogRepository catalogRepository;

    private SetUserAcademicContextsService service;
    private final UUID targetId = UUID.randomUUID();
    private final UUID actorId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new SetUserAcademicContextsService(userRepository, contextRepository, catalogRepository);
        when(userRepository.findById(targetId)).thenReturn(Optional.of(mock(User.class)));
    }

    @Test
    void directorAssignmentValidatesCatalogAndReplacesContexts() {
        var input = new SetUserAcademicContextsCommand.AcademicContextInput(10, "025");
        var command = new SetUserAcademicContextsCommand(actorId, targetId, List.of(input));
        var saved = new UserAcademicContext(UUID.randomUUID(), targetId, 10, "025");
        when(userRepository.findRoleNamesByUserId(targetId)).thenReturn(List.of("ROLE_DIRECTOR"));
        when(catalogRepository.existsActiveFaculty(10)).thenReturn(true);
        when(catalogRepository.existsActiveProgram("025", 10)).thenReturn(true);
        when(contextRepository.replaceAllForUser(eq(targetId), anyList())).thenReturn(List.of(saved));

        assertEquals(List.of(saved), service.execute(command));
        verify(contextRepository).replaceAllForUser(targetId, List.of(new UserAcademicContext(null, targetId, 10, "025")));
    }

    @Test
    void decanoCanBeAssignedFacultyOnly() {
        var command = new SetUserAcademicContextsCommand(actorId, targetId,
                List.of(new SetUserAcademicContextsCommand.AcademicContextInput(10, null)));
        when(userRepository.findRoleNamesByUserId(targetId)).thenReturn(List.of("DECANO"));
        when(catalogRepository.existsActiveFaculty(10)).thenReturn(true);
        when(contextRepository.replaceAllForUser(eq(targetId), anyList())).thenAnswer(invocation -> invocation.getArgument(1));

        var result = service.execute(command);

        assertEquals(1, result.size());
        assertEquals(10, result.getFirst().facultyId());
        assertNull(result.getFirst().careerId());
    }

    @Test
    void missingRoleSnapshotFailsClosedWithoutReplacing() {
        when(userRepository.findRoleNamesByUserId(targetId)).thenReturn(List.of("STUDENT"));
        var command = new SetUserAcademicContextsCommand(actorId, targetId, List.of());

        assertThrows(UserRoleSnapshotNotFoundException.class, () -> service.execute(command));
        verifyNoInteractions(contextRepository);
    }

    @Test
    void invalidRoleContextShapeDoesNotReplaceExistingContexts() {
        when(userRepository.findRoleNamesByUserId(targetId)).thenReturn(List.of("DECANO"));
        var command = new SetUserAcademicContextsCommand(actorId, targetId,
                List.of(new SetUserAcademicContextsCommand.AcademicContextInput(10, "025")));

        assertThrows(InvalidDeanAcademicContextException.class, () -> service.execute(command));
        verifyNoInteractions(contextRepository);
    }

    @Test
    void careerFromAnotherFacultyIsRejectedBeforeReplacement() {
        when(userRepository.findRoleNamesByUserId(targetId)).thenReturn(List.of("DIRECTOR"));
        when(catalogRepository.existsActiveFaculty(10)).thenReturn(true);
        when(catalogRepository.existsActiveProgram("025", 10)).thenReturn(false);
        var command = new SetUserAcademicContextsCommand(actorId, targetId,
                List.of(new SetUserAcademicContextsCommand.AcademicContextInput(10, "025")));

        assertThrows(CareerNotFoundException.class, () -> service.execute(command));
        verifyNoInteractions(contextRepository);
    }
}
