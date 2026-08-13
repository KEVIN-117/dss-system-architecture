package uatf.keycloak;

import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.events.admin.ResourceType;
import org.keycloak.models.KeycloakSession;
import org.keycloak.representations.idm.UserRepresentation;
import org.keycloak.util.JsonSerialization;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;
import java.util.logging.Logger;

public class WebhookEventListenerProvider implements EventListenerProvider {
    private static final Logger logger = Logger.getLogger(WebhookEventListenerProvider.class.toGenericString());

    private final KeycloakSession session;
    private final String webhookUrl;
    private final String webhookSecret;
    private final HttpClient httpClient;

    public WebhookEventListenerProvider(KeycloakSession session, String webhookUrl, String webhookSecret){
        this.session = session;
        this.webhookUrl = webhookUrl;
        this.webhookSecret = webhookSecret;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    @Override
    public void onEvent(Event event) {

    }

    @Override
    public void onEvent(AdminEvent event, boolean includeRepresentation) {
        if (ResourceType.USER.equals(event.getResourceType())){
            String operationType = event.getOperationType().name();
            if ("CREATE".equals(operationType) || "UPDATE".equals(operationType)){
                logger.info("Sincronizando evento administrativo de usuario: " + operationType);
                dispatchWebhook(event);
            }
        }
    }

    private void dispatchWebhook(AdminEvent event) {
        try {
            String representation = event.getRepresentation();
            if (representation == null || representation.trim().isEmpty()) {
                logger.warning("El evento administrativo de usuario no contiene representación de datos.");
                return;
            }

            // Deserializar la representación de Keycloak
            UserRepresentation userRep = JsonSerialization.readValue(representation, UserRepresentation.class);

            // Obtener el ID del usuario en Keycloak (si no viene en la representación, lo extraemos de la ruta del recurso)
            String keycloakId = userRep.getId();
            if (keycloakId == null || keycloakId.trim().isEmpty()) {
                String resourcePath = event.getResourcePath(); // e.g. "users/3fa85f64-5717..."
                if (resourcePath != null && resourcePath.startsWith("users/")) {
                    keycloakId = resourcePath.replace("users/", "").trim();
                } else {
                    keycloakId = "";
                }
            }

            String eventType = "UPDATE".equals(event.getOperationType().name()) ? "USER_UPDATED" : "USER_CREATED";

            // Construir el JSON de manera segura
            String jsonPayload = String.format(
                    "{\"eventId\":\"%s\",\"realmId\":\"%s\",\"eventType\":\"%s\",\"timestamp\":%d,\"user\":{" +
                            "\"keycloakId\":\"%s\"," +
                            "\"username\":\"%s\"," +
                            "\"email\":\"%s\"," +
                            "\"firstName\":\"%s\"," +
                            "\"lastName\":\"%s\"," +
                            "\"isActive\":%b" +
                            "}}",
                    UUID.randomUUID().toString(),
                    event.getRealmId(),
                    eventType,
                    event.getTime(),
                    escapeJson(keycloakId),
                    escapeJson(userRep.getUsername()),
                    escapeJson(userRep.getEmail()),
                    escapeJson(userRep.getFirstName()),
                    escapeJson(userRep.getLastName()),
                    userRep.isEnabled() == null || userRep.isEnabled()
            );

            // Enviar la petición HTTP POST de forma asíncrona para no bloquear el hilo de Keycloak
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(webhookUrl))
                    .header("Content-Type", "application/json")
                    .header("X-Webhook-Secret", webhookSecret)
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .timeout(Duration.ofSeconds(10))
                    .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                    .thenAccept(response -> {
                        if (response.statusCode() >= 200 && response.statusCode() < 300) {
                            logger.info("Sincronización exitosa. HTTP Status: " + response.statusCode());
                        } else {
                            logger.warning("Error al sincronizar con auth-service. HTTP Status: " + response.statusCode() + " Response: " +  response.body());
                        }
                    })
                    .exceptionally(ex -> {
                        logger.warning("Fallo al enviar la petición de webhook a auth-service " + ex);
                        return null;
                    });

        } catch (Exception e) {
            logger.warning("Error al procesar el webhook de sincronización de usuario " +  e);
        }
    }

    private String escapeJson(String input) {
        if (input == null) {
            return "";
        }
        return input.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\b", "\\b")
                .replace("\f", "\\f")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    @Override
    public void close() {

    }
}
