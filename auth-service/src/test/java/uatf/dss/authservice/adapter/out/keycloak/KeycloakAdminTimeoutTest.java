package uatf.dss.authservice.adapter.out.keycloak;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import uatf.dss.authservice.domain.exception.upstream.IdentityProviderUnavailableException;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** With the real JDK HTTP client: an unreachable or silent Keycloak fails fast with 503 instead of hanging. */
class KeycloakAdminTimeoutTest {

    private static KeycloakAdminProperties properties(String baseUrl) {
        return new KeycloakAdminProperties(baseUrl, "uatf-dss-realm", "uatf-auth-service", "secret",
                Duration.ofMillis(500), Duration.ofMillis(500), 0, Duration.ofMillis(10), Duration.ofSeconds(30));
    }

    @Test
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void unreachableKeycloakAnswers503() throws IOException {
        int closedPort;
        try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            closedPort = socket.getLocalPort();
        }
        KeycloakAdminModule module = KeycloakAdminModule.create(properties("http://127.0.0.1:" + closedPort), Clock.systemUTC());

        assertThatThrownBy(() -> module.roles().listRealmRoles())
                .isInstanceOf(IdentityProviderUnavailableException.class);
    }

    @Test
    @Timeout(value = 10, unit = TimeUnit.SECONDS)
    void silentKeycloakHitsTheReadTimeoutAndAnswers503() throws Exception {
        List<Socket> accepted = new ArrayList<>();
        try (ServerSocket silent = new ServerSocket(0, 10, InetAddress.getLoopbackAddress())) {
            Thread acceptor = Thread.ofVirtual().start(() -> {
                try {
                    while (!silent.isClosed()) {
                        accepted.add(silent.accept()); // accept and never answer
                    }
                } catch (IOException closed) {
                    // server socket closed at the end of the test
                }
            });
            KeycloakAdminModule module = KeycloakAdminModule.create(
                    properties("http://127.0.0.1:" + silent.getLocalPort()), Clock.systemUTC());

            assertThatThrownBy(() -> module.users().countUsers(null))
                    .isInstanceOf(IdentityProviderUnavailableException.class);
            acceptor.interrupt();
        } finally {
            for (Socket socket : accepted) {
                socket.close();
            }
        }
    }
}
