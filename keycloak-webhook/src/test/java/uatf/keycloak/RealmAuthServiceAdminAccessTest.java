package uatf.keycloak;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.TreeSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Guards the least-privilege Admin REST API access of the {@code uatf-auth-service} service account (IAM-001).
 *
 * <p>auth-service manages users, realm roles (permission composites), client roles and clients on behalf of the
 * admin portal. Creating realm roles and editing their composites requires {@code manage-realm}; everything else is
 * covered by the user/client roles. {@code realm-admin}, {@code manage-authorization},
 * {@code manage-identity-providers} and {@code manage-events} must never be granted.
 */
class RealmAuthServiceAdminAccessTest {

    private static final Set<String> EXPECTED_REALM_MANAGEMENT_ROLES = Set.of(
            "manage-clients", "manage-realm", "manage-users",
            "query-clients", "query-groups", "query-users",
            "view-clients", "view-realm", "view-users");

    private static JsonNode realm() throws Exception {
        Path realmExport = Path.of("..", "infra", "keycloak", "realm", "uatf-dss-realm-realm.json");
        try (InputStream in = Files.newInputStream(realmExport)) {
            return new ObjectMapper().readTree(in);
        }
    }

    private static JsonNode serviceAccountOf(JsonNode realm, String clientId) {
        for (JsonNode user : realm.path("users")) {
            if (clientId.equals(user.path("serviceAccountClientId").asText())) {
                return user;
            }
        }
        return null;
    }

    @Test
    void authServiceServiceAccountHasExactlyTheLeastPrivilegeAdminRoles() throws Exception {
        JsonNode account = serviceAccountOf(realm(), "uatf-auth-service");
        assertNotNull(account, "service-account-uatf-auth-service must exist in the realm export");

        Set<String> granted = new TreeSet<>();
        account.path("clientRoles").path("realm-management").forEach(role -> granted.add(role.asText()));
        assertEquals(new TreeSet<>(EXPECTED_REALM_MANAGEMENT_ROLES), granted, "realm-management roles");
    }

    @Test
    void authServiceClientOnlyAllowsClientCredentials() throws Exception {
        JsonNode client = null;
        for (JsonNode candidate : realm().path("clients")) {
            if ("uatf-auth-service".equals(candidate.path("clientId").asText())) {
                client = candidate;
            }
        }
        assertNotNull(client, "uatf-auth-service must exist in the realm export");
        assertTrue(client.path("serviceAccountsEnabled").asBoolean(false), "needs a service account");
        assertFalse(client.path("standardFlowEnabled").asBoolean(true), "must not allow browser login");
        assertFalse(client.path("directAccessGrantsEnabled").asBoolean(true), "must not allow password grant");
        assertFalse(client.path("implicitFlowEnabled").asBoolean(true), "must not allow implicit flow");
    }

    @Test
    void noOtherServiceAccountHoldsRealmManagementRoles() throws Exception {
        for (JsonNode user : realm().path("users")) {
            String clientId = user.path("serviceAccountClientId").asText("");
            if (!clientId.isEmpty() && !"uatf-auth-service".equals(clientId)) {
                assertTrue(user.path("clientRoles").path("realm-management").isMissingNode(),
                        clientId + " service account must not hold realm-management roles");
            }
        }
    }
}
