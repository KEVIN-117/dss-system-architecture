package uatf.keycloak;

import org.keycloak.Config;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventListenerProviderFactory;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

public class WebhookEventListenerProviderFactory implements EventListenerProviderFactory {

    private RabbitMqUserEventPublisher publisher;

    @Override
    public EventListenerProvider create(KeycloakSession session) {
        return new WebhookEventListenerProvider(session, publisher);
    }

    @Override
    public void init(Config.Scope config) {
        String host = requiredEnv("RABBITMQ_HOST");
        int port = Integer.parseInt(requiredEnv("RABBITMQ_PORT"));
        String username = requiredEnv("RABBITMQ_USERNAME");
        String password = requiredEnv("RABBITMQ_PASSWORD");
        String virtualHost = System.getenv().getOrDefault("RABBITMQ_VHOST", "/");
        this.publisher = new RabbitMqUserEventPublisher(host, port, username, password, virtualHost);
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " must be configured for the Keycloak RabbitMQ event publisher");
        }
        return value;
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {
        // No se requiere inicialización posterior
    }

    @Override
    public void close() {
        if (publisher != null) {
            try {
                publisher.close();
            } catch (Exception e) {
                throw new IllegalStateException("No se pudo cerrar la conexión del publisher RabbitMQ", e);
            }
        }
    }

    @Override
    public String getId() {
        return "uatf-webhook";
    }
}
