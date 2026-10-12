package uatf.dss.authservice.adapter.in.messaging;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import uatf.dss.authservice.application.port.in.KeycloakRoleSnapshot;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.application.port.out.KeycloakEventInboxRepository;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KeycloakUserEventConsumerTest {
    private static final String EVENT_ID = "f13f76c2-e5c9-43c0-ae3d-c202f11f9259";
    private static final UUID USER_ID = UUID.fromString("6d629115-0be6-4f6e-97b4-dd0c78e20ea0");

    private SyncUserUseCase syncUserUseCase;
    private KeycloakEventInboxRepository eventInboxRepository;
    private KeycloakUserEventConsumer consumer;

    @BeforeEach
    void setUp() {
        syncUserUseCase = mock(SyncUserUseCase.class);
        eventInboxRepository = mock(KeycloakEventInboxRepository.class);
        consumer = new KeycloakUserEventConsumer(new ObjectMapper(), syncUserUseCase, eventInboxRepository);
    }

    @Test
    void consumesKeycloakSnapshotAndMapsRoles() {
        when(eventInboxRepository.markAsProcessed(EVENT_ID)).thenReturn(true);

        consumer.consume(validPayload());

        verify(syncUserUseCase).sync(new SyncUserCommand(
                USER_ID,
                "test.user",
                "test.user@example.org",
                "Test",
                "User",
                true,
                java.util.List.of(new KeycloakRoleSnapshot("DECANO", false))));
    }

    @Test
    void skipsDuplicateEventWithoutApplyingSnapshotAgain() {
        when(eventInboxRepository.markAsProcessed(EVENT_ID)).thenReturn(false);

        consumer.consume(validPayload());

        verify(syncUserUseCase, never()).sync(any());
    }

    @Test
    void rejectsInvalidJsonSoBrokerCanRetryAndDeadLetterIt() {
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
                () -> consumer.consume("{invalid"));
        verify(syncUserUseCase, never()).sync(any());
    }

    private static String validPayload() {
        return """
                {
                  "eventId": "%s",
                  "realmId": "uatf-dss-realm",
                  "eventType": "USER_ROLES_UPDATED",
                  "timestamp": 1791785337000,
                  "user": {
                    "keycloakId": "%s",
                    "username": "test.user",
                    "email": "test.user@example.org",
                    "firstName": "Test",
                    "lastName": "User",
                    "isActive": true,
                    "roles": [
                      {"id": "role-1", "name": "DECANO", "clientRole": false, "containerId": "realm-id"}
                    ]
                  }
                }
                """.formatted(EVENT_ID, USER_ID);
    }
}
