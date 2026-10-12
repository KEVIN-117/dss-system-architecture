package uatf.keycloak;

import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.events.admin.ResourceType;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.RoleModel;
import org.keycloak.models.UserModel;
import org.keycloak.util.JsonSerialization;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.logging.Logger;

public class WebhookEventListenerProvider implements EventListenerProvider {
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
        if (!ResourceType.USER.equals(event.getResourceType())) {
            return;
        }

        String resourcePath = event.getResourcePath();
        String operationType = event.getOperationType().name();
        boolean roleMappingEvent = resourcePath != null && resourcePath.contains("/role-mappings");
        boolean userProfileEvent = "CREATE".equals(operationType) || "UPDATE".equals(operationType);
        boolean roleChangeEvent = roleMappingEvent && ("CREATE".equals(operationType) || "DELETE".equals(operationType));

        if (userProfileEvent || roleChangeEvent) {
            String eventType = roleChangeEvent
                    ? "USER_ROLES_UPDATED"
                    : "UPDATE".equals(operationType) ? "USER_UPDATED" : "USER_CREATED";
            dispatchWebhook(event, eventType);
        }
    }

    private void dispatchWebhook(AdminEvent event, String eventType) {
        String eventId = null;
        String keycloakId = null;
        try {
            keycloakId = extractUserId(event.getResourcePath());
            if (keycloakId == null) {
                logger.warning("Se ignoró un evento de usuario con una ruta de recurso inesperada");
                return;
            }

            RealmModel realm = session.realms().getRealm(event.getRealmId());
            UserModel user = realm == null ? null : session.users().getUserById(realm, keycloakId);
            if (user == null) {
                logger.warning("No se encontró el usuario para el evento de sincronización: eventType=" + eventType
                        + ", keycloakUserId=" + keycloakId);
                return;
            }

            List<RoleSnapshot> roles = user.getRoleMappingsStream()
                    .map(WebhookEventListenerProvider::toRoleSnapshot)
                    .sorted(Comparator.comparing(RoleSnapshot::id))
                    .toList();
            eventId = UUID.randomUUID().toString();
            WebhookPayload payload = new WebhookPayload(
                    eventId,
                    event.getRealmId(),
                    eventType,
                    event.getTime(),
                    new UserSnapshot(
                            keycloakId,
                            user.getUsername(),
                            user.getEmail(),
                            user.getFirstName(),
                            user.getLastName(),
                            user.isEnabled(),
                            roles));
            String jsonPayload = JsonSerialization.writeValueAsString(payload);
            publisher.publish(eventId, jsonPayload);
            logger.info("Evento de usuario confirmado por RabbitMQ: eventId=" + eventId + ", eventType=" + eventType
                    + ", keycloakUserId=" + keycloakId);

        } catch (Exception e) {
            logger.severe("No se pudo publicar el evento de usuario en RabbitMQ: eventId=" + eventId
                    + ", eventType=" + eventType + ", keycloakUserId=" + keycloakId
                    + ", failure=" + e.getClass().getSimpleName());
        }
    }

    private static String extractUserId(String resourcePath) {
        if (resourcePath == null || !resourcePath.startsWith("users/")) {
            return null;
        }
        String userId = resourcePath.substring("users/".length()).split("/", 2)[0].trim();
        return userId.isEmpty() ? null : userId;
    }

    private static RoleSnapshot toRoleSnapshot(RoleModel role) {
        return new RoleSnapshot(
                role.getId(),
                role.getName(),
                role.getDescription(),
                role.isClientRole(),
                role.getContainerId());
    }

    record WebhookPayload(String eventId, String realmId, String eventType, long timestamp, UserSnapshot user) {}

    record UserSnapshot(
            String keycloakId,
            String username,
            String email,
            String firstName,
            String lastName,
            boolean isActive,
            List<RoleSnapshot> roles) {}

    record RoleSnapshot(String id, String name, String description, boolean clientRole, String containerId) {}

    @Override
    public void close() {
    }
}
