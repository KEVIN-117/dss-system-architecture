package uatf.dss.authservice.adapter.in.messaging;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.rabbitmq.RabbitMQContainer;
import uatf.dss.authservice.TestcontainersConfiguration;

import java.time.Duration;
import java.util.UUID;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class KeycloakUserEventConsumerRabbitIntegrationTest {
    private static final String EVENT_ID = "0f0c38c3-b137-4d49-bc57-ed7c132c8621";
    private static final UUID KEYCLOAK_ID = UUID.fromString("a7730165-8a73-4dc1-a78b-2657111e8074");

    @Container
    static final RabbitMQContainer rabbit = new RabbitMQContainer("rabbitmq:4.3-management");

    @Autowired
    private RabbitTemplate rabbitTemplate;

    @Autowired
    private RabbitAdmin rabbitAdmin;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void rabbitProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.rabbitmq.host", rabbit::getHost);
        registry.add("spring.rabbitmq.port", rabbit::getAmqpPort);
        registry.add("spring.rabbitmq.username", () -> "guest");
        registry.add("spring.rabbitmq.password", () -> "guest");
        registry.add("spring.rabbitmq.dynamic", () -> true);
        registry.add("spring.rabbitmq.listener.simple.auto-startup", () -> true);
    }

    @BeforeEach
    void clearData() {
        jdbcTemplate.execute("TRUNCATE TABLE processed_keycloak_events, user_academic_contexts, user_roles, users CASCADE");
        rabbitAdmin.purgeQueue(RabbitMessagingConfiguration.USER_EVENTS_QUEUE, false);
        rabbitAdmin.purgeQueue(RabbitMessagingConfiguration.DEAD_LETTER_QUEUE, false);
    }

    @Test
    void consumesSnapshotPersistsUserAndDeduplicatesRedelivery() {
        String payload = eventPayload();
        rabbitTemplate.convertAndSend("", RabbitMessagingConfiguration.USER_EVENTS_QUEUE, payload);

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            assertEquals(1, count("SELECT COUNT(*) FROM users WHERE keycloak_id = ?", KEYCLOAK_ID));
            assertEquals(1, count("SELECT COUNT(*) FROM processed_keycloak_events WHERE event_id = ?", EVENT_ID));
        });

        rabbitTemplate.convertAndSend("", RabbitMessagingConfiguration.USER_EVENTS_QUEUE, payload);

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertEquals(0, rabbitAdmin.getQueueInfo(RabbitMessagingConfiguration.USER_EVENTS_QUEUE).getMessageCount()));

        assertEquals(1, count("SELECT COUNT(*) FROM users WHERE keycloak_id = ?", KEYCLOAK_ID));
        assertEquals(1, count("SELECT COUNT(*) FROM processed_keycloak_events WHERE event_id = ?", EVENT_ID));
        assertEquals(1, count("SELECT COUNT(*) FROM user_roles ur JOIN users u ON u.id = ur.user_id JOIN roles r ON r.id = ur.role_id WHERE u.keycloak_id = ? AND r.name = 'DECANO'", KEYCLOAK_ID));
    }

    private int count(String sql, Object value) {
        return jdbcTemplate.queryForObject(sql, Integer.class, value);
    }

    private static String eventPayload() {
        return """
                {
                  "eventId": "%s",
                  "realmId": "uatf-dss-realm",
                  "eventType": "USER_ROLES_UPDATED",
                  "timestamp": 1791785337000,
                  "user": {
                    "keycloakId": "%s",
                    "username": "rabbit.user",
                    "email": "rabbit.user@example.org",
                    "firstName": "Rabbit",
                    "lastName": "User",
                    "isActive": true,
                    "roles": [
                      {"id": "role-3", "name": "DECANO", "description": "Decano", "clientRole": false, "containerId": "realm-id"}
                    ]
                  }
                }
                """.formatted(EVENT_ID, KEYCLOAK_ID);
    }
}
