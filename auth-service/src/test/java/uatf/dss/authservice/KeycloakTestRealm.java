package uatf.dss.authservice;

import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.Transferable;
import org.testcontainers.utility.DockerImageName;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;

/**
 * One Keycloak per test JVM with the repository realm ({@code infra/keycloak/realm/uatf-dss-realm-realm.json})
 * imported. Started on first use and stopped by Testcontainers when the JVM exits, so every integration test that
 * needs Keycloak shares the ~50 s start-up. Tests must use unique names because they share the realm.
 */
public final class KeycloakTestRealm {

    public static final String IMAGE = "quay.io/keycloak/keycloak:26.7.4";
    public static final String REALM = "uatf-dss-realm";
    public static final String AUTH_SERVICE_CLIENT_ID = "uatf-auth-service";
    public static final String AUTH_SERVICE_SECRET = "it-auth-service-" + UUID.randomUUID();

    private static GenericContainer<?> container;

    private KeycloakTestRealm() {
    }

    public static synchronized GenericContainer<?> container() {
        if (container == null) {
            container = new GenericContainer<>(DockerImageName.parse(IMAGE))
                    .withExposedPorts(8080)
                    .withEnv("KC_BOOTSTRAP_ADMIN_USERNAME", "admin")
                    .withEnv("KC_BOOTSTRAP_ADMIN_PASSWORD", "admin-" + UUID.randomUUID())
                    .withEnv("KEYCLOAK_BFF_CLIENT_SECRET", "it-bff")
                    .withEnv("KEYCLOAK_OLAP_CLIENT_SECRET", "it-olap")
                    .withEnv("KEYCLOAK_AUTH_SERVICE_CLIENT_SECRET", AUTH_SERVICE_SECRET)
                    // Keycloak requires the import file to be named <realm>-realm.json.
                    .withCopyToContainer(Transferable.of(realmForStockImage()),
                            "/opt/keycloak/data/import/" + REALM + "-realm.json")
                    .withCommand("start-dev", "--import-realm")
                    .waitingFor(Wait.forHttp("/realms/" + REALM + "/.well-known/openid-configuration")
                            .forPort(8080)
                            .withStartupTimeout(Duration.ofMinutes(4)));
            container.start();
        }
        return container;
    }

    public static String baseUrl() {
        GenericContainer<?> keycloak = container();
        return "http://" + keycloak.getHost() + ":" + keycloak.getMappedPort(8080);
    }

    /** The stock image has no {@code uatf-webhook} provider (it lives in our image), so the listener is dropped. */
    private static String realmForStockImage() {
        try {
            String realm = Files.readString(Path.of("..", "infra", "keycloak", "realm", REALM + "-realm.json"));
            String withoutWebhook = realm.replaceFirst("\"uatf-webhook\",\\s*", "");
            if (withoutWebhook.equals(realm)) {
                throw new IllegalStateException("uatf-webhook listener not found in the realm export");
            }
            return withoutWebhook;
        } catch (IOException e) {
            throw new IllegalStateException("cannot read the realm export", e);
        }
    }
}
