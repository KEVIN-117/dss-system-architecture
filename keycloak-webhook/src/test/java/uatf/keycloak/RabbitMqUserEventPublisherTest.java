package uatf.keycloak;

import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import com.rabbitmq.client.GetResponse;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.rabbitmq.RabbitMQContainer;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@Testcontainers(disabledWithoutDocker = true)
class RabbitMqUserEventPublisherTest {
    @Container
    static final RabbitMQContainer rabbit = new RabbitMQContainer("rabbitmq:4.3-management");

    @Test
    void publishesPersistentMessageAndDeclaresDurableQueues() throws Exception {
        RabbitMqUserEventPublisher publisher = new RabbitMqUserEventPublisher(
                rabbit.getHost(), rabbit.getAmqpPort(), "guest", "guest", "/");
        String eventId = "f13f76c2-e5c9-43c0-ae3d-c202f11f9259";
        String payload = "{\"eventId\":\"" + eventId + "\"}";

        try {
            publisher.publish(eventId, payload);
        } finally {
            publisher.close();
        }

        ConnectionFactory receiverFactory = new ConnectionFactory();
        receiverFactory.setHost(rabbit.getHost());
        receiverFactory.setPort(rabbit.getAmqpPort());
        receiverFactory.setUsername("guest");
        receiverFactory.setPassword("guest");
        try (Connection connection = receiverFactory.newConnection(); Channel channel = connection.createChannel()) {
            GetResponse response = channel.basicGet(RabbitMqUserEventPublisher.QUEUE, true);
            assertNotNull(response);
            assertEquals(eventId, response.getProps().getMessageId());
            assertEquals(2, response.getProps().getDeliveryMode());
            assertEquals(payload, new String(response.getBody(), StandardCharsets.UTF_8));
            assertNotNull(channel.queueDeclarePassive(RabbitMqUserEventPublisher.QUEUE));
            assertNotNull(channel.queueDeclarePassive("keycloak.user.events.dlq"));
        }
    }
}
