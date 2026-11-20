package uatf.dss.authservice.application;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uatf.dss.authservice.application.port.out.AdminAuditLogRepository;
import uatf.dss.authservice.application.service.AdminAuditRecorder;
import uatf.dss.authservice.domain.exception.upstream.IdentityProviderUnavailableException;
import uatf.dss.authservice.domain.model.audit.AdminAuditEntry;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.audit.AuditOutcome;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AdminAuditRecorderTest {

    private static final Instant NOW = Instant.parse("2026-11-20T10:00:00Z");
    private static final AuditActor ACTOR = new AuditActor("kc-1", "ana.admin", "203.0.113.9");

    @Mock
    private AdminAuditLogRepository repository;

    private AdminAuditRecorder recorder() {
        return new AdminAuditRecorder(repository, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static AdminAuditRecorder.Operation operation() {
        return new AdminAuditRecorder.Operation(ACTOR, "ROLE_CREATED", AuditTargetType.ROLE, "COORDINADOR",
                () -> Map.of("exists", false));
    }

    // ---- local -----------------------------------------------------------------------------------------------

    @Test
    void localSuccessIsAppendedInTheCallersTransaction() {
        String result = recorder().recordLocal(operation(), () -> "ok", value -> Map.of("result", value));

        assertThat(result).isEqualTo("ok");
        ArgumentCaptor<AdminAuditEntry> entry = ArgumentCaptor.forClass(AdminAuditEntry.class);
        verify(repository).append(entry.capture());
        verify(repository, never()).appendIndependently(any());
        assertThat(entry.getValue().outcome()).isEqualTo(AuditOutcome.SUCCESS);
        assertThat(entry.getValue().actor()).isEqualTo(ACTOR);
        assertThat(entry.getValue().before()).containsEntry("exists", false);
        assertThat(entry.getValue().after()).containsEntry("result", "ok");
        assertThat(entry.getValue().occurredAt()).isEqualTo(NOW);
        assertThat(entry.getValue().completedAt()).isEqualTo(NOW);
    }

    @Test
    void localFailureIsWrittenIndependentlySoItSurvivesTheRollback() {
        IllegalStateException failure = new IllegalStateException("boom");

        assertThatThrownBy(() -> recorder().recordLocal(operation(), () -> {
            throw failure;
        }, value -> Map.of())).isSameAs(failure);

        ArgumentCaptor<AdminAuditEntry> entry = ArgumentCaptor.forClass(AdminAuditEntry.class);
        verify(repository).appendIndependently(entry.capture());
        verify(repository, never()).append(any());
        assertThat(entry.getValue().outcome()).isEqualTo(AuditOutcome.FAILURE);
        assertThat(entry.getValue().failureReason()).isEqualTo("IllegalStateException: boom");
        assertThat(entry.getValue().after()).isNull();
    }

    @Test
    void failureReadingTheBeforeStateIsAlsoAudited() {
        AdminAuditRecorder.Operation broken = new AdminAuditRecorder.Operation(ACTOR, "ROLE_CREATED",
                AuditTargetType.ROLE, "X", () -> {
            throw new IllegalArgumentException("no such role");
        });

        assertThatThrownBy(() -> recorder().recordLocal(broken, () -> "never", value -> Map.of()))
                .isInstanceOf(IllegalArgumentException.class);
        verify(repository).appendIndependently(any());
    }

    @Test
    void auditFailureNeverHidesTheOperationFailure() {
        IllegalStateException failure = new IllegalStateException("boom");
        IllegalStateException auditDown = new IllegalStateException("db down");
        doThrow(auditDown).when(repository).appendIndependently(any());

        assertThatThrownBy(() -> recorder().recordLocal(operation(), () -> {
            throw failure;
        }, value -> Map.of())).isSameAs(failure).satisfies(e -> assertThat(e.getSuppressed()).contains(auditDown));
    }

    @Test
    void localSuccessFailsIfTheAuditRowCannotBeWrittenSoTheChangeRollsBack() {
        doThrow(new IllegalStateException("db down")).when(repository).append(any());

        assertThatThrownBy(() -> recorder().recordLocal(operation(), () -> "ok", value -> Map.of()))
                .hasMessage("db down");
    }

    // ---- remote ----------------------------------------------------------------------------------------------

    @Test
    void remoteSuccessCommitsPendingFirstThenCompletes() {
        AtomicBoolean called = new AtomicBoolean();

        String result = recorder().recordRemote(operation(), () -> {
            called.set(true);
            return "created";
        }, value -> Map.of("name", value));

        assertThat(result).isEqualTo("created");
        assertThat(called).isTrue();
        ArgumentCaptor<AdminAuditEntry> pending = ArgumentCaptor.forClass(AdminAuditEntry.class);
        ArgumentCaptor<AdminAuditEntry> completed = ArgumentCaptor.forClass(AdminAuditEntry.class);
        InOrder order = inOrder(repository);
        order.verify(repository).appendIndependently(pending.capture());
        order.verify(repository).completeIndependently(completed.capture());
        assertThat(pending.getValue().outcome()).isEqualTo(AuditOutcome.PENDING);
        assertThat(pending.getValue().completedAt()).isNull();
        assertThat(completed.getValue().id()).isEqualTo(pending.getValue().id());
        assertThat(completed.getValue().outcome()).isEqualTo(AuditOutcome.SUCCESS);
        assertThat(completed.getValue().after()).containsEntry("name", "created");
        assertThat(completed.getValue().before()).containsEntry("exists", false);
    }

    @Test
    void remoteFailureCompletesAsFailureAndRethrows() {
        IdentityProviderUnavailableException failure = new IdentityProviderUnavailableException("Keycloak no está disponible.");

        assertThatThrownBy(() -> recorder().recordRemote(operation(), () -> {
            throw failure;
        }, value -> Map.of())).isSameAs(failure);

        ArgumentCaptor<AdminAuditEntry> completed = ArgumentCaptor.forClass(AdminAuditEntry.class);
        verify(repository).completeIndependently(completed.capture());
        assertThat(completed.getValue().outcome()).isEqualTo(AuditOutcome.FAILURE);
        assertThat(completed.getValue().failureReason())
                .isEqualTo("IdentityProviderUnavailableException: Keycloak no está disponible.");
    }

    @Test
    void remoteChangeIsNotAttemptedWhenThePendingRowCannotBeWritten() {
        doThrow(new IllegalStateException("db down")).when(repository).appendIndependently(any());
        AtomicBoolean called = new AtomicBoolean();

        assertThatThrownBy(() -> recorder().recordRemote(operation(), () -> {
            called.set(true);
            return "x";
        }, value -> Map.of())).hasMessage("db down");
        assertThat(called).isFalse();
    }

    @Test
    void remoteSuccessIsReturnedEvenIfCompletingTheRowFails() {
        doThrow(new IllegalStateException("db down")).when(repository).completeIndependently(any());

        assertThat(recorder().recordRemote(operation(), () -> "created", value -> Map.of())).isEqualTo("created");
    }
}
