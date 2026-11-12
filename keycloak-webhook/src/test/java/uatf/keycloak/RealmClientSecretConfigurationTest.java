package uatf.keycloak;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Guards the client secrets in the committed realm export.
 *
 * <p>Confidential clients that a service actually authenticates with must take their secret from an
 * environment placeholder that {@code --import-realm} resolves at start-up. A masked export value
 * ({@code **********}) or a placeholder on the wrong client silently becomes that client's literal
 * secret on import, and the real service then fails with {@code invalid_client}.
 */
class RealmClientSecretConfigurationTest {

    private static final Map<String, String> EXPECTED_SECRET_PLACEHOLDERS = Map.of(
            "dss-bff", "${KEYCLOAK_BFF_CLIENT_SECRET}",
            "olap-service", "${KEYCLOAK_OLAP_CLIENT_SECRET}");

    private static Map<String, JsonNode> clients() throws Exception {
        Path realmExport = Path.of("..", "infra", "keycloak", "realm", "uatf-dss-realm-realm.json");
        Map<String, JsonNode> byClientId = new HashMap<>();
        try (InputStream in = Files.newInputStream(realmExport)) {
            for (JsonNode client : new ObjectMapper().readTree(in).path("clients")) {
                byClientId.put(client.path("clientId").asText(), client);
            }
        }
        return byClientId;
    }

    private static String secretOf(JsonNode client) {
        JsonNode secret = client.get("secret");
        return secret == null || secret.isNull() ? null : secret.asText();
    }

    @Test
    void serviceClientsTakeTheirSecretFromTheirOwnPlaceholder() throws Exception {
        Map<String, JsonNode> clients = clients();
        EXPECTED_SECRET_PLACEHOLDERS.forEach((clientId, placeholder) -> {
            JsonNode client = clients.get(clientId);
            assertNotNull(client, clientId + " must exist in the realm export");
            assertFalse(client.path("publicClient").asBoolean(false), clientId + " must be confidential");
            assertEquals(placeholder, secretOf(client), clientId + " secret placeholder");
        });
    }

    @Test
    void eachSecretPlaceholderIsUsedByExactlyOneClient() throws Exception {
        Map<String, Long> placeholderUse = clients().values().stream()
                .map(RealmClientSecretConfigurationTest::secretOf)
                .filter(secret -> secret != null && secret.startsWith("${"))
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));

        EXPECTED_SECRET_PLACEHOLDERS.values().forEach(placeholder ->
                assertEquals(1L, placeholderUse.getOrDefault(placeholder, 0L),
                        placeholder + " must be set on exactly one client"));
        assertTrue(EXPECTED_SECRET_PLACEHOLDERS.values().containsAll(placeholderUse.keySet()),
                "unexpected secret placeholders: " + placeholderUse.keySet());
    }

    @Test
    void olapServiceIsAServiceAccountWithoutInteractiveLogin() throws Exception {
        JsonNode olap = clients().get("olap-service");
        assertTrue(olap.path("serviceAccountsEnabled").asBoolean(false), "olap-service needs a service account");
        assertFalse(olap.path("standardFlowEnabled").asBoolean(true), "olap-service must not allow browser login");
        assertFalse(olap.path("directAccessGrantsEnabled").asBoolean(true), "olap-service must not allow password grant");
    }
}
