package uatf.dss.authservice.adapter.in.messaging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import uatf.dss.authservice.application.port.in.IdentitySyncUseCase;
import uatf.dss.authservice.application.port.in.IdentitySyncUseCase.RoleChangeNotice;
import uatf.dss.authservice.application.port.in.KeycloakRoleSnapshot;
import uatf.dss.authservice.application.port.in.KeycloakUserEvent;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.application.port.out.KeycloakEventInboxRepository;

import java.util.List;
import java.util.Locale;

/**
 * Consumes {@code keycloak.user.events}. Every message is recorded in the inbox first, in the same transaction as
 * its effects, so a redelivered or duplicated message is applied once. Invalid messages fail and, after the listener
 * retries, go to the dead-letter queue; messages with an event type this version does not know are acknowledged and
 * ignored, so the publisher can add new types before auth-service handles them.
 */
@Component
public class KeycloakUserEventConsumer {
    private static final Logger log = LoggerFactory.getLogger(KeycloakUserEventConsumer.class);

    private final ObjectMapper objectMapper;
    private final SyncUserUseCase syncUserUseCase;
    private final IdentitySyncUseCase identitySync;
    private final KeycloakEventInboxRepository eventInboxRepository;

    public KeycloakUserEventConsumer(
            ObjectMapper objectMapper,
            SyncUserUseCase syncUserUseCase,
            IdentitySyncUseCase identitySync,
            KeycloakEventInboxRepository eventInboxRepository) {
        this.objectMapper = objectMapper;
        this.syncUserUseCase = syncUserUseCase;
        this.identitySync = identitySync;
        this.eventInboxRepository = eventInboxRepository;
    }

    @RabbitListener(queues = RabbitMessagingConfiguration.USER_EVENTS_QUEUE)
    @Transactional
    public void consume(String payload) {
        KeycloakUserEvent event = parse(payload);
        if (event.eventId() == null || event.eventId().isBlank()) {
            throw new IllegalArgumentException("Keycloak user event must contain eventId");
        }
        String eventType = event.eventType() == null ? KeycloakUserEvent.USER_UPDATED : event.eventType();
        validate(event, eventType);

        if (!eventInboxRepository.markAsProcessed(event.eventId())) {
            return;
        }

        switch (eventType) {
            case KeycloakUserEvent.USER_CREATED, KeycloakUserEvent.USER_UPDATED, KeycloakUserEvent.USER_ROLES_UPDATED ->
                    sync(event.user());
            case KeycloakUserEvent.USER_DELETED -> identitySync.removeLocalUser(event.user().keycloakId());
            case KeycloakUserEvent.ROLE_CHANGED -> identitySync.resyncAfterRoleChange(toNotice(event.role()));
            default -> log.warn("Evento de Keycloak ignorado por tipo desconocido: eventId={}, eventType={}, schemaVersion={}",
                    event.eventId(), eventType, event.effectiveSchemaVersion());
        }
    }

    private static void validate(KeycloakUserEvent event, String eventType) {
        if (KeycloakUserEvent.ROLE_CHANGED.equals(eventType)) {
            if (event.role() == null || event.role().change() == null) {
                throw new IllegalArgumentException("Keycloak role event must contain role.change");
            }
            return;
        }
        if (event.user() == null || event.user().keycloakId() == null) {
            throw new IllegalArgumentException("Keycloak user event must contain a user keycloakId");
        }
    }

    private void sync(KeycloakUserEvent.UserSnapshot user) {
        List<KeycloakUserEvent.RoleSnapshot> source = user.rolesForSnapshot();
        List<KeycloakRoleSnapshot> roles = source == null
                ? null
                : source.stream().map(role -> new KeycloakRoleSnapshot(role.name(), role.clientRole())).toList();
        syncUserUseCase.sync(new SyncUserCommand(
                user.keycloakId(),
                user.username(),
                user.email(),
                user.firstName(),
                user.lastName(),
                user.isActive(),
                roles));
    }

    private static RoleChangeNotice toNotice(KeycloakUserEvent.RoleChange role) {
        RoleChangeNotice.Change change;
        try {
            change = RoleChangeNotice.Change.valueOf(role.change().trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            throw new IllegalArgumentException("Unknown role change: " + role.change(), unknown);
        }
        return new RoleChangeNotice(role.name(), role.clientRole(), role.clientId(), change, role.mayAffectRealmRoles());
    }

    private KeycloakUserEvent parse(String payload) {
        try {
            return objectMapper.readValue(payload, KeycloakUserEvent.class);
        } catch (JacksonException exception) {
            throw new IllegalArgumentException("Invalid Keycloak user event JSON", exception);
        }
    }
}
