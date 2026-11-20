package uatf.keycloak;

import com.fasterxml.jackson.databind.JsonNode;
import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.events.admin.OperationType;
import org.keycloak.events.admin.ResourceType;
import org.keycloak.models.ClientModel;
import org.keycloak.models.GroupModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.RoleModel;
import org.keycloak.models.UserModel;
import org.keycloak.util.JsonSerialization;

import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Logger;
import java.util.stream.Stream;

/**
 * Publishes the admin events auth-service needs to keep its local copy of users and roles faithful (IAM-010).
 *
 * <table>
 *   <caption>Admin event → published event</caption>
 *   <tr><th>Keycloak admin event</th><th>Published {@code eventType}</th></tr>
 *   <tr><td>USER CREATE / UPDATE on {@code users/{id}}</td><td>USER_CREATED / USER_UPDATED</td></tr>
 *   <tr><td>USER DELETE on {@code users/{id}}</td><td>USER_DELETED (only the id: the user no longer exists)</td></tr>
 *   <tr><td>REALM_ROLE_MAPPING / CLIENT_ROLE_MAPPING on {@code users/{id}/role-mappings/...}</td><td>USER_ROLES_UPDATED</td></tr>
 *   <tr><td>GROUP_MEMBERSHIP on {@code users/{id}/groups/...}</td><td>USER_ROLES_UPDATED (group roles are effective roles)</td></tr>
 *   <tr><td>REALM_ROLE / CLIENT_ROLE: composites added or removed, role updated or deleted</td><td>ROLE_CHANGED</td></tr>
 * </table>
 *
 * Every user snapshot carries the direct role mappings ({@code roles}, unchanged since schema 1) and, since schema 2,
 * the effective roles ({@code effectiveRoles}: direct, from groups and expanded composites), which is what tokens
 * contain. New fields are only ever added, so a schema-1 consumer keeps working.
 */
public class WebhookEventListenerProvider implements EventListenerProvider {
    static final int SCHEMA_VERSION = 2;

    private static final Logger logger = Logger.getLogger(WebhookEventListenerProvider.class.getName());

    private final KeycloakSession session;
    private final RabbitMqUserEventPublisher publisher;

    public WebhookEventListenerProvider(KeycloakSession session, RabbitMqUserEventPublisher publisher) {
        this.session = session;
        this.publisher = publisher;
    }

    @Override
    public void onEvent(Event event) {

    }

    @Override
    public void onEvent(AdminEvent event, boolean includeRepresentation) {
        ResourceType resourceType = event.getResourceType();
        OperationType operation = event.getOperationType();
        String path = event.getResourcePath();
        if (resourceType == null || operation == null || path == null) {
            return;
        }
        switch (resourceType) {
            case USER -> onUserEvent(event, operation, path);
            case REALM_ROLE_MAPPING, CLIENT_ROLE_MAPPING, GROUP_MEMBERSHIP -> {
                if (isUserSubresource(path) && (operation == OperationType.CREATE || operation == OperationType.DELETE)) {
                    publishUserSnapshot(event, "USER_ROLES_UPDATED");
                }
            }
            case REALM_ROLE, CLIENT_ROLE -> onRoleEvent(event, resourceType, operation, path);
            default -> {
            }
        }
    }

    private void onUserEvent(AdminEvent event, OperationType operation, String path) {
        if (isUserSubresource(path)) {
            // Older Keycloak versions reported role mappings with resource type USER.
            if (path.contains("/role-mappings") && (operation == OperationType.CREATE || operation == OperationType.DELETE)) {
                publishUserSnapshot(event, "USER_ROLES_UPDATED");
            }
            return;
        }
        switch (operation) {
            case CREATE -> publishUserSnapshot(event, "USER_CREATED");
            case UPDATE -> publishUserSnapshot(event, "USER_UPDATED");
            case DELETE -> publishUserDeleted(event);
            default -> {
            }
        }
    }

    // ---- users ---------------------------------------------------------------------------------------------

    private void publishUserSnapshot(AdminEvent event, String eventType) {
        String keycloakId = extractUserId(event.getResourcePath());
        if (keycloakId == null) {
            logger.warning("Se ignoró un evento de usuario con una ruta de recurso inesperada");
            return;
        }
        String eventId = UUID.randomUUID().toString();
        try {
            RealmModel realm = session.realms().getRealm(event.getRealmId());
            UserModel user = realm == null ? null : session.users().getUserById(realm, keycloakId);
            if (user == null) {
                logger.warning("No se encontró el usuario para el evento de sincronización: eventType=" + eventType
                        + ", keycloakUserId=" + keycloakId);
                return;
            }
            UserSnapshot snapshot = new UserSnapshot(
                    keycloakId,
                    user.getUsername(),
                    user.getEmail(),
                    user.getFirstName(),
                    user.getLastName(),
                    user.isEnabled(),
                    sorted(user.getRoleMappingsStream()),
                    sorted(effectiveRoles(user)));
            publish(new WebhookPayload(SCHEMA_VERSION, eventId, event.getRealmId(), eventType, event.getTime(),
                    snapshot, null), eventType, "keycloakUserId=" + keycloakId);
        } catch (Exception e) {
            logFailure(eventId, eventType, "keycloakUserId=" + keycloakId, e);
        }
    }

    private void publishUserDeleted(AdminEvent event) {
        String keycloakId = extractUserId(event.getResourcePath());
        if (keycloakId == null) {
            logger.warning("Se ignoró un evento de usuario con una ruta de recurso inesperada");
            return;
        }
        String eventId = UUID.randomUUID().toString();
        try {
            UserSnapshot snapshot = new UserSnapshot(keycloakId, null, null, null, null, false, null, null);
            publish(new WebhookPayload(SCHEMA_VERSION, eventId, event.getRealmId(), "USER_DELETED", event.getTime(),
                    snapshot, null), "USER_DELETED", "keycloakUserId=" + keycloakId);
        } catch (Exception e) {
            logFailure(eventId, "USER_DELETED", "keycloakUserId=" + keycloakId, e);
        }
    }

    /** Direct mappings, roles of the user's groups and their ancestors, all with composites expanded. */
    static Stream<RoleModel> effectiveRoles(UserModel user) {
        Map<String, RoleModel> found = new LinkedHashMap<>();
        Deque<RoleModel> pending = new ArrayDeque<>();
        user.getRoleMappingsStream().forEach(pending::add);
        Stream<GroupModel> groups = user.getGroupsStream();
        if (groups != null) {
            groups.forEach(group -> {
                for (GroupModel current = group; current != null; current = current.getParent()) {
                    Stream<RoleModel> groupRoles = current.getRoleMappingsStream();
                    if (groupRoles != null) {
                        groupRoles.forEach(pending::add);
                    }
                }
            });
        }
        while (!pending.isEmpty()) {
            RoleModel role = pending.pop();
            if (found.putIfAbsent(role.getId(), role) == null && role.isComposite()) {
                Stream<RoleModel> composites = role.getCompositesStream();
                if (composites != null) {
                    composites.forEach(pending::add);
                }
            }
        }
        return found.values().stream();
    }

    private static List<RoleSnapshot> sorted(Stream<RoleModel> roles) {
        return roles.map(WebhookEventListenerProvider::toRoleSnapshot)
                .sorted(Comparator.comparing(RoleSnapshot::id))
                .toList();
    }

    private static boolean isUserSubresource(String resourcePath) {
        return extractUserId(resourcePath) != null && resourcePath.indexOf('/', "users/".length()) > 0;
    }

    private static String extractUserId(String resourcePath) {
        if (resourcePath == null || !resourcePath.startsWith("users/")) {
            return null;
        }
        String userId = resourcePath.substring("users/".length()).split("/", 2)[0].trim();
        return userId.isEmpty() ? null : userId;
    }

    // ---- roles ---------------------------------------------------------------------------------------------

    private void onRoleEvent(AdminEvent event, ResourceType resourceType, OperationType operation, String path) {
        boolean compositesPath = path.contains("/composites");
        String change;
        if (compositesPath && operation == OperationType.CREATE) {
            change = "COMPOSITES_ADDED";
        } else if (compositesPath && operation == OperationType.DELETE) {
            change = "COMPOSITES_REMOVED";
        } else if (!compositesPath && operation == OperationType.DELETE) {
            change = "DELETED";
        } else if (!compositesPath && operation == OperationType.UPDATE) {
            change = "UPDATED";
        } else {
            return; // A new role has no holders yet; nothing to resynchronize.
        }
        boolean clientRole = resourceType == ResourceType.CLIENT_ROLE;
        String eventId = UUID.randomUUID().toString();
        try {
            RoleReference reference = RoleReference.parse(path);
            if (reference == null) {
                logger.warning("Se ignoró un evento de rol con una ruta de recurso inesperada");
                return;
            }
            RealmModel realm = session.realms().getRealm(event.getRealmId());
            RoleModel role = resolve(realm, reference);
            String name = role != null ? role.getName() : reference.name();
            if ("UPDATED".equals(change) && reference.name() != null && role != null
                    && reference.name().equals(role.getName())) {
                return; // Description or attributes only: tokens and effective roles do not change.
            }
            String clientId = null;
            if (clientRole && realm != null && reference.clientUuid() != null) {
                ClientModel client = realm.getClientById(reference.clientUuid());
                clientId = client == null ? null : client.getClientId();
            }
            RoleChange roleChange = new RoleChange(
                    role != null ? role.getId() : reference.id(),
                    name,
                    clientRole,
                    clientId,
                    change,
                    affectsRealmRoles(change, event.getRepresentation()));
            publish(new WebhookPayload(SCHEMA_VERSION, eventId, event.getRealmId(), "ROLE_CHANGED", event.getTime(),
                    null, roleChange), "ROLE_CHANGED", "role=" + name + ", change=" + change);
        } catch (Exception e) {
            logFailure(eventId, "ROLE_CHANGED", "change=" + change, e);
        }
    }

    private static RoleModel resolve(RealmModel realm, RoleReference reference) {
        if (realm == null) {
            return null;
        }
        if (reference.id() != null) {
            return realm.getRoleById(reference.id());
        }
        if (reference.clientUuid() != null) {
            ClientModel client = realm.getClientById(reference.clientUuid());
            return client == null ? null : client.getRole(reference.name());
        }
        return realm.getRole(reference.name());
    }

    /**
     * A composites change only alters the effective <em>realm</em> roles when a realm role was added or removed.
     * Adding permissions (client roles) to a role is the common case and needs no resynchronization of the local
     * realm-role snapshot. Without a representation the answer is unknown, so it is {@code true}.
     */
    static boolean affectsRealmRoles(String change, String representation) {
        if (!change.startsWith("COMPOSITES_") || representation == null || representation.isBlank()) {
            return true;
        }
        try {
            JsonNode roles = JsonSerialization.mapper.readTree(representation);
            if (!roles.isArray() || roles.isEmpty()) {
                return true;
            }
            for (JsonNode role : roles) {
                if (!role.path("clientRole").asBoolean(false)) {
                    return true;
                }
            }
            return false;
        } catch (Exception unreadable) {
            return true;
        }
    }

    /** Role addressed by an admin path: {@code roles/{name}}, {@code roles-by-id/{id}} or {@code clients/{uuid}/roles/{name}}. */
    record RoleReference(String id, String name, String clientUuid) {
        static RoleReference parse(String path) {
            String[] parts = path.split("/");
            if (parts.length >= 2 && "roles-by-id".equals(parts[0])) {
                return new RoleReference(parts[1], null, null);
            }
            if (parts.length >= 2 && "roles".equals(parts[0])) {
                return new RoleReference(null, parts[1], null);
            }
            if (parts.length >= 4 && "clients".equals(parts[0]) && "roles".equals(parts[2])) {
                return new RoleReference(null, parts[3], parts[1]);
            }
            return null;
        }
    }

    // ---- publishing ----------------------------------------------------------------------------------------

    private void publish(WebhookPayload payload, String eventType, String subject) throws Exception {
        publisher.publish(payload.eventId(), JsonSerialization.writeValueAsString(payload));
        logger.info("Evento confirmado por RabbitMQ: eventId=" + payload.eventId() + ", eventType=" + eventType
                + ", " + subject);
    }

    private static void logFailure(String eventId, String eventType, String subject, Exception e) {
        logger.severe("No se pudo publicar el evento en RabbitMQ: eventId=" + eventId + ", eventType=" + eventType
                + ", " + subject + ", failure=" + e.getClass().getSimpleName());
    }

    private static RoleSnapshot toRoleSnapshot(RoleModel role) {
        return new RoleSnapshot(
                role.getId(),
                role.getName(),
                role.getDescription(),
                role.isClientRole(),
                role.getContainerId());
    }

    record WebhookPayload(int schemaVersion, String eventId, String realmId, String eventType, long timestamp,
                          UserSnapshot user, RoleChange role) {}

    record UserSnapshot(
            String keycloakId,
            String username,
            String email,
            String firstName,
            String lastName,
            boolean isActive,
            List<RoleSnapshot> roles,
            List<RoleSnapshot> effectiveRoles) {}

    record RoleSnapshot(String id, String name, String description, boolean clientRole, String containerId) {}

    /**
     * @param clientId          public client id for client roles ({@code null} for realm roles)
     * @param change            COMPOSITES_ADDED, COMPOSITES_REMOVED, UPDATED (renamed) or DELETED
     * @param affectsRealmRoles whether the effective realm roles of the role's holders may have changed
     */
    record RoleChange(String id, String name, boolean clientRole, String clientId, String change,
                      boolean affectsRealmRoles) {}

    @Override
    public void close() {
    }
}
