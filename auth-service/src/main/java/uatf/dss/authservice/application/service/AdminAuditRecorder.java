package uatf.dss.authservice.application.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import uatf.dss.authservice.application.port.out.AdminAuditLogRepository;
import uatf.dss.authservice.domain.model.audit.AdminAuditEntry;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.audit.AuditOutcome;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;

import java.time.Clock;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;

import static net.logstash.logback.argument.StructuredArguments.kv;

/**
 * Wraps every administrative write so it always leaves an audit row, even when it fails (IAM-005). Every entry is
 * also written as a JSON line to {@code AUDIT_LOGGER}, as before.
 *
 * <ul>
 *     <li>{@link #recordLocal}: for changes to auth-service's own database. On success the row is appended in the
 *     caller's transaction (atomic with the change); on failure it is written in an independent transaction so it
 *     survives the rollback.</li>
 *     <li>{@link #recordRemote}: for changes executed in Keycloak, which no local transaction can cover. A
 *     {@code PENDING} row is committed <em>before</em> the call (if that fails, the call is not made), then completed
 *     as {@code SUCCESS} or {@code FAILURE}. A row left {@code PENDING} means the outcome is unknown.</li>
 * </ul>
 */
public class AdminAuditRecorder {

    private static final Logger AUDIT_LOGGER = LoggerFactory.getLogger("AUDIT_LOGGER");
    private static final Logger log = LoggerFactory.getLogger(AdminAuditRecorder.class);

    private final AdminAuditLogRepository repository;
    private final Clock clock;

    public AdminAuditRecorder(AdminAuditLogRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    /** What is being done, to what, and by whom. {@code before} is read when the operation starts. */
    public record Operation(
            AuditActor actor,
            String action,
            AuditTargetType targetType,
            String targetId,
            Supplier<Map<String, Object>> before) {
    }

    public <T> T recordLocal(Operation operation, Supplier<T> change, Function<? super T, Map<String, Object>> after) {
        Map<String, Object> before = null;
        T result;
        try {
            before = readBefore(operation);
            result = change.get();
        } catch (RuntimeException failure) {
            AdminAuditEntry entry = newEntry(operation, before, null, AuditOutcome.FAILURE, describe(failure));
            try {
                repository.appendIndependently(entry);
            } catch (RuntimeException auditFailure) {
                failure.addSuppressed(auditFailure);
                log.error("No se pudo registrar en auditoría el fallo de '{}'", operation.action(), auditFailure);
            }
            emit(entry);
            throw failure;
        }
        AdminAuditEntry entry = newEntry(operation, before, after.apply(result), AuditOutcome.SUCCESS, null);
        repository.append(entry);
        emit(entry);
        return result;
    }

    public <T> T recordRemote(Operation operation, Supplier<T> change, Function<? super T, Map<String, Object>> after) {
        Map<String, Object> before = readBefore(operation);
        AdminAuditEntry pending = newEntry(operation, before, null, AuditOutcome.PENDING, null);
        repository.appendIndependently(pending);

        T result;
        try {
            result = change.get();
        } catch (RuntimeException failure) {
            complete(pending.completed(AuditOutcome.FAILURE, null, describe(failure), clock.instant()), failure);
            throw failure;
        }
        complete(pending.completed(AuditOutcome.SUCCESS, after.apply(result), null, clock.instant()), null);
        return result;
    }

    private Map<String, Object> readBefore(Operation operation) {
        return operation.before() == null ? null : operation.before().get();
    }

    private void complete(AdminAuditEntry entry, RuntimeException operationFailure) {
        try {
            repository.completeIndependently(entry);
        } catch (RuntimeException auditFailure) {
            // The remote change already happened (or failed); the PENDING row stays as evidence. Never hide the
            // operation's own outcome behind an audit failure.
            if (operationFailure != null) {
                operationFailure.addSuppressed(auditFailure);
            }
            log.error("No se pudo completar el registro de auditoría {} de '{}'; queda PENDING",
                    entry.id(), entry.action(), auditFailure);
        }
        emit(entry);
    }

    private AdminAuditEntry newEntry(Operation operation, Map<String, Object> before, Map<String, Object> after,
                                     AuditOutcome outcome, String failureReason) {
        var now = clock.instant();
        return new AdminAuditEntry(UUID.randomUUID(), now, operation.actor(), operation.action(),
                operation.targetType(), operation.targetId(), before, after, outcome, failureReason,
                outcome == AuditOutcome.PENDING ? null : now);
    }

    private static String describe(RuntimeException failure) {
        String message = failure.getMessage();
        return message == null || message.isBlank()
                ? failure.getClass().getSimpleName()
                : failure.getClass().getSimpleName() + ": " + message;
    }

    private static void emit(AdminAuditEntry entry) {
        AUDIT_LOGGER.info("Operación administrativa",
                kv("event_type", entry.action()),
                kv("audit_id", entry.id()),
                kv("outcome", entry.outcome()),
                kv("actor_keycloak_id", entry.actor().keycloakId()),
                kv("actor_username", entry.actor().username()),
                kv("ip_address", entry.actor().ipAddress()),
                kv("target_type", entry.targetType()),
                kv("target_id", entry.targetId()),
                kv("failure_reason", entry.failureReason()));
    }
}
