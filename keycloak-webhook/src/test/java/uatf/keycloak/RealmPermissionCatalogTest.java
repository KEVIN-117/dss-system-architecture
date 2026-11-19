package uatf.keycloak;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Guards the functional permission model in the realm export (IAM-002, decisions D1 and D4).
 *
 * <p>Permissions are client roles of the bearer-only catalog client {@code dss-permissions}, named
 * {@code resource:action}. Realm roles group them as composites. The legacy {@code uatf-auth-service} client roles
 * stay in the composites while services migrate.
 */
class RealmPermissionCatalogTest {

    private static final String CATALOG = "dss-permissions";
    private static final Pattern PERMISSION_NAME = Pattern.compile("^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)+$");

    private static final List<String> DIRECTOR = List.of("analytics:read", "analytics:career");
    private static final List<String> DECANO = concat(DIRECTOR, "analytics:faculty", "pipelines:read");
    private static final List<String> RECTOR = concat(DECANO, "analytics:global", "connectors:read");
    private static final List<String> SUPERADMIN = List.of(
            "connectors:read", "connectors:write", "pipelines:read", "pipelines:execute", "prediction:train",
            "iam:users:read", "iam:users:write", "iam:roles:read", "iam:roles:write",
            "iam:clients:read", "iam:clients:write", "iam:audit:read");

    private static final Map<String, List<String>> EXPECTED_PERMISSIONS = Map.of(
            "DIRECTOR", DIRECTOR, "DECANO", DECANO, "RECTOR", RECTOR, "SUPERADMIN", SUPERADMIN);

    private static final Map<String, List<String>> EXPECTED_LEGACY_ROLES = Map.of(
            "DIRECTOR", List.of("DIRECTOR"),
            "DECANO", List.of("DECANO", "DIRECTOR"),
            "RECTOR", List.of("DECANO", "DIRECTOR", "RECTOR"),
            "SUPERADMIN", List.of("SUPERADMIN"));

    private static List<String> concat(List<String> base, String... more) {
        List<String> all = new java.util.ArrayList<>(base);
        all.addAll(List.of(more));
        return List.copyOf(all);
    }

    private static JsonNode realm() throws Exception {
        Path realmExport = Path.of("..", "infra", "keycloak", "realm", "uatf-dss-realm-realm.json");
        try (InputStream in = Files.newInputStream(realmExport)) {
            return new ObjectMapper().readTree(in);
        }
    }

    private static JsonNode client(JsonNode realm, String clientId) {
        for (JsonNode client : realm.path("clients")) {
            if (clientId.equals(client.path("clientId").asText())) {
                return client;
            }
        }
        return null;
    }

    private static JsonNode realmRole(JsonNode realm, String name) {
        for (JsonNode role : realm.path("roles").path("realm")) {
            if (name.equals(role.path("name").asText())) {
                return role;
            }
        }
        return null;
    }

    private static Set<String> names(JsonNode array) {
        Set<String> names = new TreeSet<>();
        array.forEach(node -> names.add(node.isTextual() ? node.asText() : node.path("name").asText()));
        return names;
    }

    private static Set<String> catalogPermissions(JsonNode realm) {
        return names(realm.path("roles").path("client").path(CATALOG));
    }

    @Test
    void catalogClientIsBearerOnlyWithoutCredentialsOrFlows() throws Exception {
        JsonNode catalog = client(realm(), CATALOG);
        assertNotNull(catalog, CATALOG + " must exist in the realm export");
        assertTrue(catalog.path("bearerOnly").asBoolean(false), "must be bearer-only");
        assertFalse(catalog.path("publicClient").asBoolean(true), "must not be public");
        assertFalse(catalog.path("standardFlowEnabled").asBoolean(true), "no browser login");
        assertFalse(catalog.path("directAccessGrantsEnabled").asBoolean(true), "no password grant");
        assertFalse(catalog.path("implicitFlowEnabled").asBoolean(true), "no implicit flow");
        assertFalse(catalog.path("serviceAccountsEnabled").asBoolean(true), "no service account");
        assertNull(catalog.get("secret"), "bearer-only catalog must not carry a secret");
    }

    @Test
    void everyPermissionIsNamedResourceActionAndDescribed() throws Exception {
        JsonNode permissions = realm().path("roles").path("client").path(CATALOG);
        assertTrue(permissions.size() > 0, "catalog must define permissions");
        for (JsonNode permission : permissions) {
            String name = permission.path("name").asText();
            assertTrue(PERMISSION_NAME.matcher(name).matches(), name + " must follow resource:action");
            assertFalse(permission.path("description").asText("").isBlank(), name + " needs a description");
            assertFalse(permission.path("composite").asBoolean(false), name + " must not be composite");
        }
    }

    @Test
    void realmRolesGroupExactlyTheirPermissions() throws Exception {
        JsonNode realm = realm();
        EXPECTED_PERMISSIONS.forEach((roleName, expected) -> {
            JsonNode role = realmRole(realm, roleName);
            assertNotNull(role, roleName + " realm role must exist");
            assertEquals(new TreeSet<>(expected), names(role.path("composites").path("client").path(CATALOG)),
                    roleName + " permissions");
        });
    }

    @Test
    void legacyAuthServiceClientRolesAreKeptDuringMigration() throws Exception {
        JsonNode realm = realm();
        EXPECTED_LEGACY_ROLES.forEach((roleName, expected) -> assertEquals(new TreeSet<>(expected),
                names(realmRole(realm, roleName).path("composites").path("client").path("uatf-auth-service")),
                roleName + " legacy uatf-auth-service roles"));
    }

    @Test
    void everyReferencedPermissionExistsInTheCatalog() throws Exception {
        JsonNode realm = realm();
        Set<String> catalog = catalogPermissions(realm);
        for (JsonNode role : realm.path("roles").path("realm")) {
            for (String permission : names(role.path("composites").path("client").path(CATALOG))) {
                assertTrue(catalog.contains(permission), role.path("name").asText() + " references unknown " + permission);
            }
        }
        for (JsonNode user : realm.path("users")) {
            for (String permission : names(user.path("clientRoles").path(CATALOG))) {
                assertTrue(catalog.contains(permission), user.path("username").asText() + " holds unknown " + permission);
            }
        }
    }

    @Test
    void superadminHasNoBusinessOrSaikuAdminAccess() throws Exception {
        JsonNode superadmin = realmRole(realm(), "SUPERADMIN");
        JsonNode clientComposites = superadmin.path("composites").path("client");
        assertTrue(clientComposites.path("olap-service").isMissingNode(), "SUPERADMIN must not include olap-service roles");
        Set<String> permissions = names(clientComposites.path(CATALOG));
        assertFalse(permissions.contains("olap:admin"), "olap:admin is assigned explicitly, not via SUPERADMIN");
        assertTrue(permissions.stream().noneMatch(p -> p.startsWith("analytics:")), "SUPERADMIN has no analytics");
    }

    @Test
    void olapServiceAccountCanReadAcademicContext() throws Exception {
        for (JsonNode user : realm().path("users")) {
            if ("olap-service".equals(user.path("serviceAccountClientId").asText())) {
                assertTrue(names(user.path("clientRoles").path(CATALOG)).contains("context:read"));
                assertTrue(names(user.path("clientRoles").path("uatf-auth-service")).contains("CONTEXT_READER"),
                        "legacy CONTEXT_READER is kept during migration");
                return;
            }
        }
        throw new AssertionError("service-account-olap-service must exist");
    }

    @Test
    void unusedPublicSpaClientIsRemoved() throws Exception {
        JsonNode realm = realm();
        assertNull(client(realm, "uatf-dss-spa"), "uatf-dss-spa must be removed (D4)");
        assertTrue(realm.path("roles").path("client").path("uatf-dss-spa").isMissingNode());
    }

    @Test
    void migrationScriptDeclaresTheSameCatalogAsTheExport() throws Exception {
        Path script = Path.of("..", "infra", "keycloak", "migrations", "iam-002-permission-catalog.sh");
        Map<String, String> scripted = new java.util.TreeMap<>();
        Pattern entry = Pattern.compile("^\\s*\"([^|\"]+)\\|([^\"]+)\"\\s*$");
        for (String line : Files.readAllLines(script)) {
            var matcher = entry.matcher(line);
            if (matcher.matches()) {
                scripted.put(matcher.group(1), matcher.group(2));
            }
        }
        Map<String, String> exported = new java.util.TreeMap<>();
        realm().path("roles").path("client").path(CATALOG)
                .forEach(p -> exported.put(p.path("name").asText(), p.path("description").asText()));
        assertEquals(exported, scripted, "iam-002-permission-catalog.sh must match the realm export");
    }

    @Test
    void bffAccessTokensCarryTheAuthServiceAudienceExplicitly() throws Exception {
        JsonNode bff = client(realm(), "dss-bff");
        boolean found = false;
        for (JsonNode mapper : bff.path("protocolMappers")) {
            if ("oidc-audience-mapper".equals(mapper.path("protocolMapper").asText())
                    && "uatf-auth-service".equals(mapper.path("config").path("included.client.audience").asText())) {
                found = "true".equals(mapper.path("config").path("access.token.claim").asText());
            }
        }
        assertTrue(found, "dss-bff needs an access-token audience mapper for uatf-auth-service");
    }
}
