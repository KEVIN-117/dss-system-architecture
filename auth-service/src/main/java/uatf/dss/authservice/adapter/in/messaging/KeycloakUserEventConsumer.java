package uatf.dss.authservice.adapter.in.messaging;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import uatf.dss.authservice.application.port.in.KeycloakRoleSnapshot;
import uatf.dss.authservice.application.port.in.KeycloakUserEvent;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.application.port.out.KeycloakEventInboxRepository;

import java.util.List;

@Component
public class KeycloakUserEventConsumer {
    private final ObjectMapper objectMapper;
    private final SyncUserUseCase syncUserUseCase;
    private final KeycloakEventInboxRepository eventInboxRepository;

    public KeycloakUserEventConsumer(
            ObjectMapper objectMapper,
            SyncUserUseCase syncUserUseCase,
            KeycloakEventInboxRepository eventInboxRepository) {
        this.objectMapper = objectMapper;
        this.syncUserUseCase = syncUserUseCase;
        this.eventInboxRepository = eventInboxRepository;
    }

    @RabbitListener(queues = RabbitMessagingConfiguration.USER_EVENTS_QUEUE)
    @Transactional
    public void consume(String payload) {
        KeycloakUserEvent event = parse(payload);
        if (event.eventId() == null || event.eventId().isBlank()) {
            throw new IllegalArgumentException("Keycloak user event must contain eventId");
        }
        if (event.user() == null || event.user().keycloakId() == null) {
            throw new IllegalArgumentException("Keycloak user event must contain a user keycloakId");
        }

        if (!eventInboxRepository.markAsProcessed(event.eventId())) {
            return;
        }

        List<KeycloakRoleSnapshot> roles = event.user().roles() == null
                ? null
                : event.user().roles().stream()
                        .map(role -> new KeycloakRoleSnapshot(role.name(), role.clientRole()))
                        .toList();
        syncUserUseCase.sync(new SyncUserCommand(
                event.user().keycloakId(),
                event.user().username(),
                event.user().email(),
                event.user().firstName(),
                event.user().lastName(),
                event.user().isActive(),
                roles));
    }

    private KeycloakUserEvent parse(String payload) {
        try {
            return objectMapper.readValue(payload, KeycloakUserEvent.class);
        } catch (JacksonException exception) {
            throw new IllegalArgumentException("Invalid Keycloak user event JSON", exception);
        }
    }
}
