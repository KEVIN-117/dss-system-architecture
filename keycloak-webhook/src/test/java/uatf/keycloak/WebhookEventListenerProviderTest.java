package uatf.keycloak;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.events.admin.OperationType;
import org.keycloak.events.admin.ResourceType;
import com.fasterxml.jackson.databind.JsonNode;
import org.keycloak.models.ClientModel;
import org.keycloak.models.GroupModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.RealmProvider;
import org.keycloak.models.RoleModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.UserProvider;
import org.keycloak.util.JsonSerialization;

import java.util.ArrayList;
import java.util.List;
import java.util.logging.Handler;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
        // Keycloak 26 reports role mappings as REALM_ROLE_MAPPING / CLIENT_ROLE_MAPPING, not as USER (IAM-010).
        provider.onEvent(event(ResourceType.REALM_ROLE_MAPPING, OperationType.CREATE, "users/user-1/role-mappings/realm"), false);
        provider.onEvent(event(ResourceType.REALM_ROLE_MAPPING, OperationType.DELETE, "users/user-1/role-mappings/realm"), false);
        provider.onEvent(event(ResourceType.CLIENT_ROLE_MAPPING, OperationType.CREATE,
                "users/user-1/role-mappings/clients/client-1"), false);
        provider.onEvent(event(ResourceType.GROUP_MEMBERSHIP, OperationType.CREATE, "users/user-1/groups/group-1"), false);
        // Older servers used USER for the same path.
        provider.onEvent(event(OperationType.DELETE, "users/user-1/role-mappings/realm"), false);

        List<JsonNode> payloads = publishedPayloads(5);
        assertTrue(payloads.stream().allMatch(p -> "USER_ROLES_UPDATED".equals(p.path("eventType").asText())));
    }

    @Test
    void userSnapshotsCarrySchemaVersionDirectAndEffectiveRoles() throws Exception {
        RoleModel director = role("director-id", "DIRECTOR", false, "realm-1");
        RoleModel permission = role("perm-id", "analytics:read", true, "perm-client");
        RoleModel decano = role("decano-id", "DECANO", false, "realm-1");
        when(decano.isComposite()).thenReturn(true);
        when(decano.getCompositesStream()).thenAnswer(invocation -> Stream.of(director, permission));
        RoleModel groupRole = role("group-role-id", "GROUP_ROLE", false, "realm-1");
        GroupModel parent = mock(GroupModel.class);
        when(parent.getRoleMappingsStream()).thenAnswer(invocation -> Stream.of(groupRole));
        GroupModel group = mock(GroupModel.class);
        when(group.getParent()).thenReturn(parent);
        when(group.getRoleMappingsStream()).thenAnswer(invocation -> Stream.empty());
        when(user.getRoleMappingsStream()).thenAnswer(invocation -> Stream.of(decano));
        when(user.getGroupsStream()).thenAnswer(invocation -> Stream.of(group));

        provider.onEvent(event(OperationType.CREATE, "users/user-1"), false);

        JsonNode payload = publishedPayloads(1).getFirst();
        assertEquals(WebhookEventListenerProvider.SCHEMA_VERSION, payload.path("schemaVersion").asInt());
        assertEquals(List.of("DECANO"), names(payload.path("user").path("roles")));
        assertEquals(List.of("DECANO", "DIRECTOR", "GROUP_ROLE", "analytics:read"),
                names(payload.path("user").path("effectiveRoles")).stream().sorted().toList());
    }

    @Test
    void compositeCyclesAreExpandedOnce() {
        RoleModel a = role("a", "A", false, "realm-1");
        RoleModel b = role("b", "B", false, "realm-1");
        when(a.isComposite()).thenReturn(true);
        when(b.isComposite()).thenReturn(true);
        when(a.getCompositesStream()).thenAnswer(invocation -> Stream.of(b));
        when(b.getCompositesStream()).thenAnswer(invocation -> Stream.of(a));
        when(user.getRoleMappingsStream()).thenAnswer(invocation -> Stream.of(a));

        assertEquals(2, WebhookEventListenerProvider.effectiveRoles(user).count());
    }

    @Test
    void publishesUserDeletedWithOnlyTheIdBecauseTheUserIsGone() throws Exception {
        provider.onEvent(event(OperationType.DELETE, "users/user-1"), false);

        JsonNode payload = publishedPayloads(1).getFirst();
        assertEquals("USER_DELETED", payload.path("eventType").asText());
        assertEquals("user-1", payload.path("user").path("keycloakId").asText());
        assertFalse(payload.toString().contains("private@example.test"));
        assertFalse(payload.toString().contains("test-user"));
    }

    @Test
    void realmRoleCompositeChangesArePublishedAsRoleChanged() throws Exception {
        RoleModel decano = role("decano-id", "DECANO", false, "realm-1");
        when(realm.getRole("DECANO")).thenReturn(decano);
        when(realm.getRoleById("decano-id")).thenReturn(decano);

        provider.onEvent(roleEvent(ResourceType.REALM_ROLE, OperationType.CREATE, "roles/DECANO/composites",
                "[{\"name\":\"DIRECTOR\",\"clientRole\":false}]"), true);
        provider.onEvent(roleEvent(ResourceType.REALM_ROLE, OperationType.DELETE, "roles-by-id/decano-id/composites",
                "[{\"name\":\"analytics:read\",\"clientRole\":true}]"), true);

        List<JsonNode> payloads = publishedPayloads(2);
        JsonNode added = payloads.get(0);
        assertEquals("ROLE_CHANGED", added.path("eventType").asText());
        assertEquals(WebhookEventListenerProvider.SCHEMA_VERSION, added.path("schemaVersion").asInt());
        assertEquals("DECANO", added.path("role").path("name").asText());
        assertEquals("COMPOSITES_ADDED", added.path("role").path("change").asText());
        assertTrue(added.path("role").path("affectsRealmRoles").asBoolean());
        assertTrue(added.path("user").isMissingNode() || added.path("user").isNull());
        JsonNode removed = payloads.get(1);
        assertEquals("COMPOSITES_REMOVED", removed.path("role").path("change").asText());
        assertEquals("DECANO", removed.path("role").path("name").asText());
        assertFalse(removed.path("role").path("affectsRealmRoles").asBoolean(),
                "only permissions (client roles) changed: the realm-role snapshot is unaffected");
    }

    @Test
    void deletedAndRenamedRolesArePublishedButDescriptionEditsAndNewRolesAreNot() throws Exception {
        RoleModel renamed = role("old-id", "NUEVO", false, "realm-1");
        when(realm.getRole("VIEJO")).thenReturn(null);
        when(realm.getRole("NUEVO")).thenReturn(renamed);
        when(realm.getRoleById("gone-id")).thenReturn(null);

        provider.onEvent(roleEvent(ResourceType.REALM_ROLE, OperationType.DELETE, "roles-by-id/gone-id", null), false);
        provider.onEvent(roleEvent(ResourceType.REALM_ROLE, OperationType.UPDATE, "roles/VIEJO", null), false);
        provider.onEvent(roleEvent(ResourceType.REALM_ROLE, OperationType.UPDATE, "roles/NUEVO", null), false);
        provider.onEvent(roleEvent(ResourceType.REALM_ROLE, OperationType.CREATE, "roles", null), false);

        List<JsonNode> payloads = publishedPayloads(2);
        assertEquals("DELETED", payloads.get(0).path("role").path("change").asText());
        assertEquals("gone-id", payloads.get(0).path("role").path("id").asText());
        assertTrue(payloads.get(0).path("role").path("affectsRealmRoles").asBoolean());
        assertEquals("UPDATED", payloads.get(1).path("role").path("change").asText());
        assertEquals("VIEJO", payloads.get(1).path("role").path("name").asText());
    }

    @Test
    void clientRoleChangesCarryThePublicClientId() throws Exception {
        ClientModel client = mock(ClientModel.class);
        when(client.getClientId()).thenReturn("dss-permissions");
        RoleModel permission = role("perm-id", "reports:export", true, "client-uuid");
        when(client.getRole("reports:export")).thenReturn(permission);
        when(realm.getClientById("client-uuid")).thenReturn(client);

        provider.onEvent(roleEvent(ResourceType.CLIENT_ROLE, OperationType.DELETE, "clients/client-uuid/roles/reports:export",
                null), false);

        JsonNode role = publishedPayloads(1).getFirst().path("role");
        assertTrue(role.path("clientRole").asBoolean());
        assertEquals("dss-permissions", role.path("clientId").asText());
        assertEquals("reports:export", role.path("name").asText());
    }

    @Test
    void affectsRealmRolesOnlyWhenARealmRoleMayHaveChanged() {
        assertTrue(WebhookEventListenerProvider.affectsRealmRoles("DELETED", null));
        assertTrue(WebhookEventListenerProvider.affectsRealmRoles("COMPOSITES_ADDED", null));
        assertTrue(WebhookEventListenerProvider.affectsRealmRoles("COMPOSITES_ADDED", "not json"));
        assertTrue(WebhookEventListenerProvider.affectsRealmRoles("COMPOSITES_ADDED",
                "[{\"clientRole\":true},{\"clientRole\":false}]"));
        assertFalse(WebhookEventListenerProvider.affectsRealmRoles("COMPOSITES_REMOVED",
                "[{\"clientRole\":true},{\"clientRole\":true}]"));
    }

    @Test
    void ignoresUnexpectedResourceTypeAndUnexpectedUserRoute() throws Exception {
        AdminEvent unexpectedType = event(OperationType.CREATE, "users/user-1");
        when(unexpectedType.getResourceType()).thenReturn(ResourceType.REALM);
        provider.onEvent(unexpectedType, false);
        provider.onEvent(event(OperationType.CREATE, "clients/client-1/users/user-1"), false);
        provider.onEvent(event(OperationType.UPDATE, "users/user-1/reset-password"), false);
        provider.onEvent(event(ResourceType.REALM_ROLE_MAPPING, OperationType.CREATE, "groups/g-1/role-mappings/realm"), false);
        provider.onEvent(roleEvent(ResourceType.REALM_ROLE, OperationType.CREATE, "unexpected/path", null), false);

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

    private List<JsonNode> publishedPayloads(int expected) throws Exception {
        var payload = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(publisher, org.mockito.Mockito.times(expected)).publish(anyString(), payload.capture());
        List<JsonNode> nodes = new ArrayList<>();
        for (String value : payload.getAllValues()) {
            nodes.add(JsonSerialization.mapper.readTree(value));
        }
        return nodes;
    }

    private static List<String> names(JsonNode roles) {
        List<String> names = new ArrayList<>();
        roles.forEach(role -> names.add(role.path("name").asText()));
        return names;
    }

    private static AdminEvent roleEvent(ResourceType type, OperationType operation, String path, String representation) {
        AdminEvent event = event(type, operation, path);
        when(event.getRepresentation()).thenReturn(representation);
        return event;
    }

    private static AdminEvent event(OperationType operation, String resourcePath) {
        return event(ResourceType.USER, operation, resourcePath);
    }

    private static AdminEvent event(ResourceType type, OperationType operation, String resourcePath) {
        AdminEvent event = mock(AdminEvent.class);
        when(event.getResourceType()).thenReturn(type);
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
