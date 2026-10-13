package uatf.keycloak;

import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.concurrent.TimeoutException;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RabbitMqUserEventPublisherFailureTest {
    @Test
    void retriesPublisherConfirmTimeoutAndNeverIncludesPayloadInFailure() throws Exception {
        ConnectionFactory connectionFactory = mock(ConnectionFactory.class);
        Connection connection = mock(Connection.class);
        Channel channel = mock(Channel.class);
        when(connectionFactory.newConnection(anyString())).thenReturn(connection);
        when(connection.isOpen()).thenReturn(true);
        when(connection.createChannel()).thenReturn(channel);
        doThrow(new TimeoutException("confirm timeout contains no event body"))
                .when(channel).waitForConfirmsOrDie(5_000L);

        RabbitMqUserEventPublisher publisher = new RabbitMqUserEventPublisher(connectionFactory);
        IOException failure = assertThrows(IOException.class,
                () -> publisher.publish("event-123", "PII body that must not be logged"));

        verify(channel, times(3)).basicPublish(
                org.mockito.ArgumentMatchers.eq(""),
                org.mockito.ArgumentMatchers.eq(RabbitMqUserEventPublisher.QUEUE),
                org.mockito.ArgumentMatchers.eq(true),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(byte[].class));
        assertFalse(failure.getMessage().contains("PII body"));
        assertFalse(failure.getCause().getMessage().contains("PII body"));
    }
}
