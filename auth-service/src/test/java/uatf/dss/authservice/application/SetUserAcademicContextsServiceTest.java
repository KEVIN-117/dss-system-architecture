package uatf.dss.authservice.application;

import org.mockito.ArgumentCaptor;
import uatf.dss.authservice.application.port.out.AdminAuditLogRepository;
import uatf.dss.authservice.application.service.AdminAuditRecorder;
import uatf.dss.authservice.domain.model.audit.AdminAuditEntry;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.audit.AuditOutcome;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
    @Mock AdminAuditLogRepository auditLogRepository;

    private static final Instant NOW = Instant.parse("2026-11-20T10:00:00Z");
    private SetUserAcademicContextsService service;
    private final UUID targetId = UUID.randomUUID();
    private final AuditActor actor = new AuditActor(UUID.randomUUID().toString(), "ana.admin", "10.0.0.7");

    @BeforeEach
    void setUp() {
        service = new SetUserAcademicContextsService(userRepository, contextRepository, catalogRepository,
                new AdminAuditRecorder(auditLogRepository, Clock.fixed(NOW, ZoneOffset.UTC)));
        when(userRepository.findById(targetId)).thenReturn(Optional.of(mock(User.class)));
    }

    @Test
    void directorAssignmentValidatesCatalogAndReplacesContexts() {
        var input = new SetUserAcademicContextsCommand.AcademicContextInput(10, "025");
        var command = new SetUserAcademicContextsCommand(actor, targetId, List.of(input));
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
        var command = new SetUserAcademicContextsCommand(actor, targetId,
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
        var command = new SetUserAcademicContextsCommand(actor, targetId, List.of());

        assertThrows(UserRoleSnapshotNotFoundException.class, () -> service.execute(command));
        verify(contextRepository, never()).replaceAllForUser(any(), any());
    }

    @Test
    void invalidRoleContextShapeDoesNotReplaceExistingContexts() {
        when(userRepository.findRoleNamesByUserId(targetId)).thenReturn(List.of("DECANO"));
        var command = new SetUserAcademicContextsCommand(actor, targetId,
                List.of(new SetUserAcademicContextsCommand.AcademicContextInput(10, "025")));

        assertThrows(InvalidDeanAcademicContextException.class, () -> service.execute(command));
        verify(contextRepository, never()).replaceAllForUser(any(), any());
    }

    @Test
    void careerFromAnotherFacultyIsRejectedBeforeReplacement() {
        when(userRepository.findRoleNamesByUserId(targetId)).thenReturn(List.of("DIRECTOR"));
        when(catalogRepository.existsActiveFaculty(10)).thenReturn(true);
        when(catalogRepository.existsActiveProgram("025", 10)).thenReturn(false);
        var command = new SetUserAcademicContextsCommand(actor, targetId,
                List.of(new SetUserAcademicContextsCommand.AcademicContextInput(10, "025")));

        assertThrows(CareerNotFoundException.class, () -> service.execute(command));
        verify(contextRepository, never()).replaceAllForUser(any(), any());
    }

    @Test
    void successfulReplacementIsAuditedInTheSameTransactionWithBeforeAndAfter() {
        var command = new SetUserAcademicContextsCommand(actor, targetId,
                List.of(new SetUserAcademicContextsCommand.AcademicContextInput(10, null)));
        when(userRepository.findRoleNamesByUserId(targetId)).thenReturn(List.of("DECANO"));
        when(catalogRepository.existsActiveFaculty(10)).thenReturn(true);
        when(contextRepository.findAllByUserId(targetId))
                .thenReturn(List.of(new UserAcademicContext(UUID.randomUUID(), targetId, 4, null)));
        when(contextRepository.replaceAllForUser(eq(targetId), anyList())).thenAnswer(invocation -> invocation.getArgument(1));

        service.execute(command);

        ArgumentCaptor<AdminAuditEntry> entry = ArgumentCaptor.forClass(AdminAuditEntry.class);
        verify(auditLogRepository).append(entry.capture());
        verify(auditLogRepository, never()).appendIndependently(any());
        AdminAuditEntry audit = entry.getValue();
        assertEquals("USER_ACADEMIC_CONTEXTS_REPLACED", audit.action());
        assertEquals(AuditOutcome.SUCCESS, audit.outcome());
        assertEquals(AuditTargetType.USER, audit.targetType());
        assertEquals(targetId.toString(), audit.targetId());
        assertEquals(actor, audit.actor());
        assertEquals(NOW, audit.occurredAt());
        assertEquals(4, contextsOf(audit.before()).getFirst().get("facultyId"));
        assertEquals(10, contextsOf(audit.after()).getFirst().get("facultyId"));
    }

    @Test
    void rejectedReplacementIsAuditedIndependentlyAsFailure() {
        when(userRepository.findRoleNamesByUserId(targetId)).thenReturn(List.of("DECANO"));
        var command = new SetUserAcademicContextsCommand(actor, targetId,
                List.of(new SetUserAcademicContextsCommand.AcademicContextInput(10, "025")));

        assertThrows(InvalidDeanAcademicContextException.class, () -> service.execute(command));

        ArgumentCaptor<AdminAuditEntry> entry = ArgumentCaptor.forClass(AdminAuditEntry.class);
        verify(auditLogRepository).appendIndependently(entry.capture());
        verify(auditLogRepository, never()).append(any());
        assertEquals(AuditOutcome.FAILURE, entry.getValue().outcome());
        assertTrue(entry.getValue().failureReason().startsWith("InvalidDeanAcademicContextException"));
        assertNull(entry.getValue().after());
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> contextsOf(Map<String, Object> snapshot) {
        return (List<Map<String, Object>>) snapshot.get("academicContexts");
    }
}
