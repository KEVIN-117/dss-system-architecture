package uatf.dss.authservice.adapter.in.messaging;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RabbitMessagingConfigurationTest {
    private final RabbitMessagingConfiguration configuration = new RabbitMessagingConfiguration();

    @Test
    void declaresDurableEventsQueueWithDeadLetterRoute() {
        var queue = configuration.keycloakUserEventsQueue();

        assertThat(queue.getName()).isEqualTo(RabbitMessagingConfiguration.USER_EVENTS_QUEUE);
        assertThat(queue.isDurable()).isTrue();
        assertThat(queue.getArguments())
                .containsEntry("x-dead-letter-exchange", RabbitMessagingConfiguration.DEAD_LETTER_EXCHANGE)
                .containsEntry("x-dead-letter-routing-key", RabbitMessagingConfiguration.DEAD_LETTER_ROUTING_KEY);
    }

    @Test
    void declaresDurableDeadLetterQueueAndBinding() {
        var queue = configuration.keycloakUserEventsDeadLetterQueue();
        var exchange = configuration.keycloakUserEventsDeadLetterExchange();
        var binding = configuration.keycloakUserEventsDeadLetterBinding(queue, exchange);

        assertThat(queue.isDurable()).isTrue();
        assertThat(queue.getName()).isEqualTo(RabbitMessagingConfiguration.DEAD_LETTER_QUEUE);
        assertThat(binding.getExchange()).isEqualTo(RabbitMessagingConfiguration.DEAD_LETTER_EXCHANGE);
        assertThat(binding.getRoutingKey()).isEqualTo(RabbitMessagingConfiguration.DEAD_LETTER_ROUTING_KEY);
    }
}
