package uatf.keycloak;

import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;
import java.util.logging.Logger;

final class RabbitMqUserEventPublisher implements AutoCloseable {
    static final String QUEUE = "keycloak.user.events";
    static final String DEAD_LETTER_EXCHANGE = "keycloak.user.events.dlx";
    static final String DEAD_LETTER_ROUTING_KEY = "keycloak.user.events.dead";

    private static final Logger logger = Logger.getLogger(RabbitMqUserEventPublisher.class.getName());
    private static final int MAX_ATTEMPTS = 3;
    private static final long CONFIRM_TIMEOUT_MILLIS = Duration.ofSeconds(5).toMillis();

    private final ConnectionFactory connectionFactory;
    private volatile Connection connection;

    RabbitMqUserEventPublisher(String host, int port, String username, String password, String virtualHost) {
        this(createConnectionFactory(host, port, username, password, virtualHost));
    }

    RabbitMqUserEventPublisher(ConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    private static ConnectionFactory createConnectionFactory(
            String host, int port, String username, String password, String virtualHost) {
        ConnectionFactory connectionFactory = new ConnectionFactory();
        connectionFactory.setHost(host);
        connectionFactory.setPort(port);
        connectionFactory.setUsername(username);
        connectionFactory.setPassword(password);
        connectionFactory.setVirtualHost(virtualHost);
        connectionFactory.setConnectionTimeout((int) Duration.ofSeconds(5).toMillis());
        connectionFactory.setRequestedHeartbeat((int) Duration.ofSeconds(30).toSeconds());
        connectionFactory.setAutomaticRecoveryEnabled(true);
        return connectionFactory;
    }

    void publish(String eventId, String payload) throws IOException, InterruptedException {
        Exception lastFailure = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                publishOnce(eventId, payload);
                return;
            } catch (IOException | TimeoutException failure) {
                lastFailure = failure;
                discardClosedConnection();
                if (attempt < MAX_ATTEMPTS) {
                    logger.warning("RabbitMQ no confirmó el evento " + eventId + "; reintento " + (attempt + 1));
                    Thread.sleep(250L * attempt);
                }
            }
        }
        throw new IOException("RabbitMQ no confirmó el evento " + eventId + " después de " + MAX_ATTEMPTS + " intentos", lastFailure);
    }

    private void publishOnce(String eventId, String payload) throws IOException, TimeoutException, InterruptedException {
        try (Channel channel = connection().createChannel()) {
            channel.confirmSelect();
            channel.exchangeDeclare(DEAD_LETTER_EXCHANGE, "direct", true, false, null);
            channel.queueDeclare("keycloak.user.events.dlq", true, false, false, null);
            channel.queueBind("keycloak.user.events.dlq", DEAD_LETTER_EXCHANGE, DEAD_LETTER_ROUTING_KEY);
            Map<String, Object> queueArguments = new HashMap<>();
            queueArguments.put("x-dead-letter-exchange", DEAD_LETTER_EXCHANGE);
            queueArguments.put("x-dead-letter-routing-key", DEAD_LETTER_ROUTING_KEY);
            channel.queueDeclare(QUEUE, true, false, false, queueArguments);

            AtomicReference<String> returnedMessage = new AtomicReference<>();
            channel.addReturnListener((replyCode, replyText, exchange, routingKey, properties, body) ->
                    returnedMessage.set(replyCode + " " + replyText));

            AMQP.BasicProperties properties = new AMQP.BasicProperties.Builder()
                    .contentType("text/plain")
                    .contentEncoding(StandardCharsets.UTF_8.name())
                    .deliveryMode(2)
                    .messageId(eventId)
                    .build();
            channel.basicPublish("", QUEUE, true, properties, payload.getBytes(StandardCharsets.UTF_8));
            channel.waitForConfirmsOrDie(CONFIRM_TIMEOUT_MILLIS);

            String returnReason = returnedMessage.get();
            if (returnReason != null) {
                throw new IOException("RabbitMQ no pudo enrutar el evento " + eventId + ": " + returnReason);
            }
        }
    }

    private Connection connection() throws IOException, TimeoutException {
        Connection current = connection;
        if (current != null && current.isOpen()) {
            return current;
        }
        synchronized (this) {
            current = connection;
            if (current == null || !current.isOpen()) {
                connection = current = connectionFactory.newConnection("keycloak-user-events");
            }
            return current;
        }
    }

    private void discardClosedConnection() {
        Connection current = connection;
        if (current != null && !current.isOpen()) {
            synchronized (this) {
                if (connection == current) {
                    connection = null;
                }
            }
        }
    }

    @Override
    public void close() throws Exception {
        Connection current = connection;
        if (current != null && current.isOpen()) {
            current.close();
        }
    }
}
