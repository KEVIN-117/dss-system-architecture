package uatf.keycloak;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.events.admin.OperationType;
import org.keycloak.events.admin.ResourceType;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.RealmProvider;
import org.keycloak.models.RoleModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.UserProvider;

import java.util.ArrayList;
import java.util.List;
import java.util.logging.Handler;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WebhookEventListenerProviderTest {
    private KeycloakSession session;
    private RabbitMqUserEventPublisher publisher;
    private WebhookEventListenerProvider provider;
    private RealmModel realm;
    private UserModel user;

    @BeforeEach
    void setUp() {
        session = mock(KeycloakSession.class);
        publisher = mock(RabbitMqUserEventPublisher.class);
        provider = new WebhookEventListenerProvider(session, publisher);
        realm = mock(RealmModel.class);
        user = mock(UserModel.class);

        RealmProvider realms = mock(RealmProvider.class);
        UserProvider users = mock(UserProvider.class);
        when(session.realms()).thenReturn(realms);
        when(realms.getRealm("realm-1")).thenReturn(realm);
        when(session.users()).thenReturn(users);
        when(users.getUserById(realm, "user-1")).thenReturn(user);
        when(user.getUsername()).thenReturn("test-user");
        when(user.getEmail()).thenReturn("private@example.test");
        when(user.getFirstName()).thenReturn("Private");
        when(user.getLastName()).thenReturn("Person");
        when(user.isEnabled()).thenReturn(true);
        RoleModel realmRole = role("realm-role-id", "DECANO", false, "realm-1");
        RoleModel clientRole = role("client-role-id", "account:manage-account", true, "client-1");
        when(user.getRoleMappingsStream()).thenAnswer(invocation -> Stream.of(realmRole, clientRole));
    }

    @Test
    void publishesUserCreatedSnapshotIncludingRealmAndClientRoles() throws Exception {
        provider.onEvent(event(OperationType.CREATE, "users/user-1"), false);

        var payload = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(publisher).publish(anyString(), payload.capture());
        assertTrue(payload.getValue().contains("\"eventType\":\"USER_CREATED\""));
        assertTrue(payload.getValue().contains("\"name\":\"DECANO\""));
        assertTrue(payload.getValue().contains("\"name\":\"account:manage-account\""));
    }

    @Test
    void publishesUserUpdatedSnapshot() throws Exception {
        provider.onEvent(event(OperationType.UPDATE, "users/user-1"), true);

        var payload = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(publisher).publish(anyString(), payload.capture());
        assertTrue(payload.getValue().contains("\"eventType\":\"USER_UPDATED\""));
    }

    @Test
    void publishesRoleAssignmentAndRemovalAsFreshRoleSnapshots() throws Exception {
        for (OperationType operation : new OperationType[]{OperationType.CREATE, OperationType.DELETE}) {
            provider.onEvent(event(operation, "users/user-1/role-mappings/realm"), false);
        }

        var payload = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(publisher, org.mockito.Mockito.times(2)).publish(anyString(), payload.capture());
        assertTrue(payload.getAllValues().stream()
                .allMatch(value -> value.contains("\"eventType\":\"USER_ROLES_UPDATED\"")));
    }

    @Test
    void ignoresUnexpectedResourceTypeAndUnexpectedUserRoute() throws Exception {
        AdminEvent unexpectedType = event(OperationType.CREATE, "users/user-1");
        when(unexpectedType.getResourceType()).thenReturn(ResourceType.REALM);
        provider.onEvent(unexpectedType, false);
        provider.onEvent(event(OperationType.CREATE, "clients/client-1/users/user-1"), false);
        provider.onEvent(event(OperationType.DELETE, "users/user-1"), false);

        verify(publisher, never()).publish(anyString(), anyString());
    }

    @Test
    void logsPublishingFailureWithoutPuttingPersonalDataOrErrorBodyInTheMessage() throws Exception {
        org.mockito.Mockito.doThrow(new IllegalStateException("private@example.test"))
                .when(publisher).publish(anyString(), anyString());
        Logger logger = Logger.getLogger(WebhookEventListenerProvider.class.getName());
        List<String> messages = new ArrayList<>();
        Handler capture = new Handler() {
            @Override public void publish(LogRecord record) { messages.add(record.getMessage()); }
            @Override public void flush() {}
            @Override public void close() {}
        };
        logger.addHandler(capture);
        try {
            provider.onEvent(event(OperationType.CREATE, "users/user-1"), false);
        } finally {
            logger.removeHandler(capture);
        }

        verify(publisher).publish(anyString(), anyString());
        String logOutput = String.join(" ", messages);
        assertTrue(logOutput.contains("eventType=USER_CREATED"));
        assertTrue(logOutput.contains("keycloakUserId=user-1"));
        assertFalse(logOutput.contains("private@example.test"));
        assertFalse(logOutput.contains("Private"));
    }

    private static AdminEvent event(OperationType operation, String resourcePath) {
        AdminEvent event = mock(AdminEvent.class);
        when(event.getResourceType()).thenReturn(ResourceType.USER);
        when(event.getOperationType()).thenReturn(operation);
        when(event.getResourcePath()).thenReturn(resourcePath);
        when(event.getRealmId()).thenReturn("realm-1");
        when(event.getTime()).thenReturn(1_760_000_000_000L);
        return event;
    }

    private static RoleModel role(String id, String name, boolean clientRole, String containerId) {
        RoleModel role = mock(RoleModel.class);
        when(role.getId()).thenReturn(id);
        when(role.getName()).thenReturn(name);
        when(role.getDescription()).thenReturn(null);
        when(role.isClientRole()).thenReturn(clientRole);
        when(role.getContainerId()).thenReturn(containerId);
        return role;
    }
}
