package uatf.keycloak;

import org.keycloak.Config;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventListenerProviderFactory;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

public class WebhookEventListenerProviderFactory implements EventListenerProviderFactory {

    private String webhookUrl;
    private String webhookSecret;

    @Override
    public EventListenerProvider create(KeycloakSession session) {
        return new WebhookEventListenerProvider(session, webhookUrl, webhookSecret);
    }

    @Override
    public void init(Config.Scope config) {
        // Obtener configuración desde variables de entorno del contenedor
        this.webhookUrl = System.getenv("KEYCLOAK_WEBHOOK_URL");
        this.webhookSecret = System.getenv("KEYCLOAK_WEBHOOK_SECRET");

        // Valores por defecto para desarrollo local si no están configurados
        if (this.webhookUrl == null || this.webhookUrl.trim().isEmpty()) {
            this.webhookUrl = "http://127.0.0.1:8000/api/v1/auth/sync";
        }
        if (this.webhookSecret == null || this.webhookSecret.trim().isEmpty()) {
            this.webhookSecret = "dss-webhook-secret-xyz123";
        }
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {
        // No se requiere inicialización posterior
    }

    @Override
    public void close() {
        // No se requieren recursos para cerrar
    }

    @Override
    public String getId() {
        return "uatf-webhook";
    }
}
