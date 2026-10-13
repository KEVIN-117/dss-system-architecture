package uatf.dss.authservice.adapter.in.messaging;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class RabbitMessagingConfiguration {
    public static final String USER_EVENTS_QUEUE = "keycloak.user.events";
    public static final String DEAD_LETTER_EXCHANGE = "keycloak.user.events.dlx";
    public static final String DEAD_LETTER_QUEUE = "keycloak.user.events.dlq";
    public static final String DEAD_LETTER_ROUTING_KEY = "keycloak.user.events.dead";

    @Bean
    Queue keycloakUserEventsQueue() {
        return QueueBuilder.durable(USER_EVENTS_QUEUE)
                .withArgument("x-dead-letter-exchange", DEAD_LETTER_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", DEAD_LETTER_ROUTING_KEY)
                .build();
    }

    @Bean
    DirectExchange keycloakUserEventsDeadLetterExchange() {
        return new DirectExchange(DEAD_LETTER_EXCHANGE, true, false);
    }

    @Bean
    Queue keycloakUserEventsDeadLetterQueue() {
        return QueueBuilder.durable(DEAD_LETTER_QUEUE).build();
    }

    @Bean
    Binding keycloakUserEventsDeadLetterBinding(
            Queue keycloakUserEventsDeadLetterQueue,
            DirectExchange keycloakUserEventsDeadLetterExchange) {
        return BindingBuilder.bind(keycloakUserEventsDeadLetterQueue)
                .to(keycloakUserEventsDeadLetterExchange)
                .with(DEAD_LETTER_ROUTING_KEY);
    }
}
