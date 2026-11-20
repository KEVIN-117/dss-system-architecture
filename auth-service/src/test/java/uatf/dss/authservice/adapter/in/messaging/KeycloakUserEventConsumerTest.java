package uatf.dss.authservice.adapter.in.messaging;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import uatf.dss.authservice.application.port.in.IdentitySyncUseCase;
import uatf.dss.authservice.application.port.in.IdentitySyncUseCase.RoleChangeNotice;
import uatf.dss.authservice.application.port.in.KeycloakRoleSnapshot;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.application.port.out.KeycloakEventInboxRepository;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class KeycloakUserEventConsumerTest {
    private static final String EVENT_ID = "f13f76c2-e5c9-43c0-ae3d-c202f11f9259";
    private static final UUID USER_ID = UUID.fromString("6d629115-0be6-4f6e-97b4-dd0c78e20ea0");

    private SyncUserUseCase syncUserUseCase;
    private IdentitySyncUseCase identitySync;
    private KeycloakEventInboxRepository eventInboxRepository;
    private KeycloakUserEventConsumer consumer;

    @BeforeEach
    void setUp() {
        syncUserUseCase = mock(SyncUserUseCase.class);
        identitySync = mock(IdentitySyncUseCase.class);
        eventInboxRepository = mock(KeycloakEventInboxRepository.class);
        consumer = new KeycloakUserEventConsumer(new ObjectMapper(), syncUserUseCase, identitySync, eventInboxRepository);
        when(eventInboxRepository.markAsProcessed(EVENT_ID)).thenReturn(true);
    }

    @Test
    void consumesSchema1SnapshotWithDirectRoles() {
        consumer.consume(schema1Payload());

        verify(syncUserUseCase).sync(new SyncUserCommand(USER_ID, "test.user", "test.user@example.org", "Test", "User",
                true, List.of(new KeycloakRoleSnapshot("DECANO", false))));
    }

    @Test
    void schema2SnapshotUsesTheEffectiveRoles() {
        consumer.consume("""
                {"schemaVersion": 2, "eventId": "%s", "eventType": "USER_ROLES_UPDATED", "timestamp": 1,
                 "user": {"keycloakId": "%s", "username": "test.user", "email": "test.user@example.org",
                          "isActive": true,
                          "roles": [{"name": "RECTOR", "clientRole": false}],
                          "effectiveRoles": [{"name": "RECTOR", "clientRole": false},
                                             {"name": "DECANO", "clientRole": false},
                                             {"name": "analytics:read", "clientRole": true}]}}
                """.formatted(EVENT_ID, USER_ID));

        verify(syncUserUseCase).sync(new SyncUserCommand(USER_ID, "test.user", "test.user@example.org", null, null,
                true, List.of(new KeycloakRoleSnapshot("RECTOR", false), new KeycloakRoleSnapshot("DECANO", false),
                new KeycloakRoleSnapshot("analytics:read", true))));
    }

    @Test
    void userDeletedRemovesTheLocalUser() {
        consumer.consume("""
                {"schemaVersion": 2, "eventId": "%s", "eventType": "USER_DELETED", "timestamp": 1,
                 "user": {"keycloakId": "%s", "isActive": false}}
                """.formatted(EVENT_ID, USER_ID));

        verify(identitySync).removeLocalUser(USER_ID);
        verifyNoInteractions(syncUserUseCase);
    }

    @Test
    void roleChangedTriggersTheResyncOfAffectedUsers() {
        consumer.consume("""
                {"schemaVersion": 2, "eventId": "%s", "eventType": "ROLE_CHANGED", "timestamp": 1,
                 "role": {"id": "r-1", "name": "DECANO", "clientRole": false, "change": "COMPOSITES_ADDED",
                          "affectsRealmRoles": true}}
                """.formatted(EVENT_ID));

        verify(identitySync).resyncAfterRoleChange(
                new RoleChangeNotice("DECANO", false, null, RoleChangeNotice.Change.COMPOSITES_ADDED, true));
    }

    @Test
    void missingAffectsRealmRolesIsTreatedAsTrue() {
        consumer.consume("""
                {"schemaVersion": 2, "eventId": "%s", "eventType": "ROLE_CHANGED", "timestamp": 1,
                 "role": {"id": "r-1", "clientRole": false, "change": "deleted"}}
                """.formatted(EVENT_ID));

        verify(identitySync).resyncAfterRoleChange(
                new RoleChangeNotice(null, false, null, RoleChangeNotice.Change.DELETED, true));
    }

    @Test
    void duplicatesAreSkippedForEveryEventType() {
        when(eventInboxRepository.markAsProcessed(EVENT_ID)).thenReturn(false);

        consumer.consume(schema1Payload());
        consumer.consume("""
                {"eventId": "%s", "eventType": "USER_DELETED", "user": {"keycloakId": "%s", "isActive": false}}
                """.formatted(EVENT_ID, USER_ID));
        consumer.consume("""
                {"eventId": "%s", "eventType": "ROLE_CHANGED",
                 "role": {"name": "DECANO", "clientRole": false, "change": "DELETED"}}
                """.formatted(EVENT_ID));

        verifyNoInteractions(syncUserUseCase, identitySync);
    }

    @Test
    void unknownEventTypesAreAcknowledgedAndIgnored() {
        consumer.consume("""
                {"schemaVersion": 3, "eventId": "%s", "eventType": "GROUP_RENAMED",
                 "user": {"keycloakId": "%s", "isActive": true}}
                """.formatted(EVENT_ID, USER_ID));

        verify(eventInboxRepository).markAsProcessed(EVENT_ID);
        verifyNoInteractions(syncUserUseCase, identitySync);
    }

    @Test
    void invalidMessagesFailSoTheBrokerRetriesAndDeadLettersThem() {
        assertThrows(IllegalArgumentException.class, () -> consumer.consume("{invalid"));
        assertThrows(IllegalArgumentException.class, () -> consumer.consume("""
                {"eventId": "%s", "eventType": "USER_DELETED", "user": {}}
                """.formatted(EVENT_ID)));
        assertThrows(IllegalArgumentException.class, () -> consumer.consume("""
                {"eventId": "%s", "eventType": "ROLE_CHANGED"}
                """.formatted(EVENT_ID)));
        assertThrows(IllegalArgumentException.class, () -> consumer.consume("""
                {"eventId": "%s", "eventType": "ROLE_CHANGED", "role": {"change": "EXPLODED"}}
                """.formatted(EVENT_ID)));
        verify(syncUserUseCase, never()).sync(any());
        verify(identitySync, never()).resyncAfterRoleChange(any());
    }

    private static String schema1Payload() {
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
                      {"id": "role-1", "name": "DECANO", "description": "Decano", "clientRole": false, "containerId": "realm"}
                    ]
                  }
                }
                """.formatted(EVENT_ID, USER_ID);
    }
}
