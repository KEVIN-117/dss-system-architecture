package uatf.dss.authservice.adapter.in.web;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.json.JsonMapper;
import uatf.dss.authservice.KeycloakTestRealm;
import uatf.dss.authservice.TestcontainersConfiguration;
import uatf.dss.authservice.application.port.out.IdentityClientAdminPort;
import uatf.dss.authservice.domain.model.identity.IdentityClient;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * {@code /admin/iam/clients} over HTTP against a real Keycloak (repository realm, IAM-001 service account) and
 * PostgreSQL. Proves that issued secrets work, that rotation invalidates the old secret, and that secrets never
 * reach the audit table or the logs.
 */
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@ExtendWith(OutputCaptureExtension.class)
@DisplayName("IAM clients API (Keycloak + PostgreSQL)")
class IamClientControllerIntegrationTest {

    private static final String CLIENTS = "/admin/iam/clients";

    @DynamicPropertySource
    static void keycloak(DynamicPropertyRegistry registry) {
        registry.add("app.keycloak.admin.base-url", KeycloakTestRealm::baseUrl);
        registry.add("app.keycloak.admin.realm", () -> KeycloakTestRealm.REALM);
        registry.add("app.keycloak.admin.client-id", () -> KeycloakTestRealm.AUTH_SERVICE_CLIENT_ID);
        registry.add("app.keycloak.admin.client-secret", () -> KeycloakTestRealm.AUTH_SERVICE_SECRET);
    }

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private JsonMapper jsonMapper;
    @Autowired private IdentityClientAdminPort identityClients;

    @BeforeEach
    void cleanAudit() {
        jdbcTemplate.execute("TRUNCATE TABLE admin_audit_log");
    }

    private static RequestPostProcessor admin() {
        return jwt().jwt(token -> token.subject(UUID.randomUUID().toString()).claim("preferred_username", "ana.admin"))
                .authorities(new SimpleGrantedAuthority("iam:clients:read"), new SimpleGrantedAuthority("iam:clients:write"));
    }

    private static String clientId() {
        return "iam008-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String body(Object value) {
        return jsonMapper.writeValueAsString(value);
    }

    private String field(MvcResult result, String path) throws Exception {
        return jsonMapper.readTree(result.getResponse().getContentAsString()).at(path).asString();
    }

    /**
     * Status of a client_credentials token request: 200 if the secret authenticates. Uses the JDK client, which
     * logs nothing, so the test itself does not put the secret in the captured output.
     */
    private static int clientCredentialsStatus(String clientId, String secret) throws Exception {
        String form = "grant_type=client_credentials&client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
                + "&client_secret=" + URLEncoder.encode(secret, StandardCharsets.UTF_8);
        HttpRequest request = HttpRequest.newBuilder(URI.create(KeycloakTestRealm.baseUrl() + "/realms/"
                        + KeycloakTestRealm.REALM + "/protocol/openid-connect/token"))
                .header("Content-Type", MediaType.APPLICATION_FORM_URLENCODED_VALUE)
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .build();
        try (HttpClient http = HttpClient.newHttpClient()) {
            return http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
        }
    }

    private String auditTable() {
        return String.join("\n", jdbcTemplate.queryForList(
                "SELECT COALESCE(before_state::text, '') || COALESCE(after_state::text, '') || COALESCE(failure_reason, '') "
                        + "FROM admin_audit_log", String.class));
    }

    // ---- confidential client and secrets -------------------------------------------------------------------

    @Test
    @DisplayName("A confidential client gets a working secret once; rotation invalidates it; no secret is audited or logged")
    void confidentialClientAndSecretRotation(CapturedOutput output) throws Exception {
        String clientId = clientId();

        MvcResult created = mockMvc.perform(post(CLIENTS).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("clientId", clientId, "name", "Servicio de becas",
                                "type", "CONFIDENTIAL", "serviceAccountsEnabled", true))))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/admin/iam/clients/" + clientId))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andExpect(jsonPath("$.client.type").value("CONFIDENTIAL"))
                .andExpect(jsonPath("$.client.system").value(false))
                .andExpect(jsonPath("$.secret").isNotEmpty())
                .andReturn();
        String firstSecret = field(created, "/secret");
        assertThat(clientCredentialsStatus(clientId, firstSecret)).isEqualTo(200);

        mockMvc.perform(get(CLIENTS + "/{id}", clientId).with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.secret").doesNotExist());

        MvcResult rotated = mockMvc.perform(post(CLIENTS + "/{id}/secret", clientId).with(admin()))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andExpect(jsonPath("$.clientId").value(clientId))
                .andReturn();
        String newSecret = field(rotated, "/secret");
        assertThat(newSecret).isNotBlank().isNotEqualTo(firstSecret);
        assertThat(clientCredentialsStatus(clientId, newSecret)).isEqualTo(200);
        assertThat(clientCredentialsStatus(clientId, firstSecret)).as("old secret no longer works").isEqualTo(401);

        assertThat(jdbcTemplate.queryForList("SELECT action FROM admin_audit_log WHERE outcome = 'SUCCESS' ORDER BY occurred_at",
                String.class)).containsExactly("CLIENT_CREATED", "CLIENT_SECRET_ROTATED");
        assertThat(auditTable()).doesNotContain(firstSecret).doesNotContain(newSecret)
                .contains("\"issuedOnce\": true").contains("\"rotated\": true");
        assertNoSecretIn(output.getAll(), firstSecret, newSecret);
    }

    /** Fails listing the offending log lines with the secret masked, so the failure itself never leaks it. */
    private static void assertNoSecretIn(String logs, String... secrets) {
        List<String> leaks = logs.lines()
                .filter(line -> java.util.Arrays.stream(secrets).anyMatch(line::contains))
                .map(line -> {
                    String masked = line;
                    for (String secret : secrets) {
                        masked = masked.replace(secret, "<SECRET>");
                    }
                    return masked.length() > 400 ? masked.substring(0, 400) + "…" : masked;
                })
                .toList();
        assertThat(leaks).as("log lines containing a client secret").isEmpty();
    }

    // ---- public client -------------------------------------------------------------------------------------

    @Test
    @DisplayName("A public client gets no secret, keeps its URIs and can be updated and disabled")
    void publicClientLifecycle() throws Exception {
        String clientId = clientId();

        mockMvc.perform(post(CLIENTS).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("clientId", clientId, "type", "PUBLIC",
                                "redirectUris", List.of("https://becas.uatf.edu.bo/*"),
                                "webOrigins", List.of("+"),
                                "postLogoutRedirectUris", List.of("https://becas.uatf.edu.bo/")))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.secret").doesNotExist())
                .andExpect(jsonPath("$.client.type").value("PUBLIC"))
                .andExpect(jsonPath("$.client.standardFlowEnabled").value(true))
                .andExpect(jsonPath("$.client.postLogoutRedirectUris[0]").value("https://becas.uatf.edu.bo/"));

        mockMvc.perform(patch(CLIENTS + "/{id}", clientId).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("name", "Portal de becas", "enabled", false,
                                "redirectUris", List.of("https://becas.uatf.edu.bo/callback")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Portal de becas"))
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.redirectUris[0]").value("https://becas.uatf.edu.bo/callback"))
                .andExpect(jsonPath("$.postLogoutRedirectUris[0]").value("https://becas.uatf.edu.bo/"));

        IdentityClient stored = identityClients.findClient(clientId).orElseThrow();
        assertThat(stored.enabled()).isFalse();
        assertThat(stored.publicClient()).isTrue();

        mockMvc.perform(post(CLIENTS + "/{id}/secret", clientId).with(admin())).andExpect(status().isBadRequest());
        assertThat(jdbcTemplate.queryForList("SELECT action || ':' || outcome FROM admin_audit_log ORDER BY occurred_at",
                String.class)).containsExactly("CLIENT_CREATED:SUCCESS", "CLIENT_UPDATED:SUCCESS", "CLIENT_SECRET_ROTATED:FAILURE");
    }

    // ---- validation and protection -------------------------------------------------------------------------

    @Test
    @DisplayName("Rejects invalid clientIds, dangerous wildcards and duplicates")
    void rejectsInvalidInput() throws Exception {
        String clientId = clientId();
        mockMvc.perform(post(CLIENTS).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("clientId", clientId, "type", "CONFIDENTIAL")))).andExpect(status().isCreated());

        mockMvc.perform(post(CLIENTS).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("clientId", clientId, "type", "CONFIDENTIAL")))).andExpect(status().isConflict());
        mockMvc.perform(post(CLIENTS).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("clientId", "Con Espacios", "type", "PUBLIC")))).andExpect(status().isBadRequest());
        for (String uri : List.of("*", "https://*.uatf.edu.bo/*", "https://becas.uatf.edu.bo/*/cb")) {
            mockMvc.perform(post(CLIENTS).with(admin()).contentType(MediaType.APPLICATION_JSON)
                            .content(body(Map.of("clientId", clientId(), "type", "PUBLIC", "redirectUris", List.of(uri)))))
                    .andExpect(status().isBadRequest());
        }
        mockMvc.perform(post(CLIENTS).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("clientId", clientId(), "type", "PUBLIC",
                                "redirectUris", List.of("https://becas.uatf.edu.bo/*"), "webOrigins", List.of("*")))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(CLIENTS).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("clientId", clientId())))).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("System clients are read-only; dss-bff only accepts URI/name edits and keeps its secret")
    void protectsSystemClients() throws Exception {
        mockMvc.perform(patch(CLIENTS + "/olap-service").with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("name", "X")))).andExpect(status().isConflict());
        mockMvc.perform(patch(CLIENTS + "/dss-bff").with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("enabled", false)))).andExpect(status().isConflict());
        mockMvc.perform(post(CLIENTS + "/dss-bff/secret").with(admin())).andExpect(status().isConflict());
        mockMvc.perform(post(CLIENTS + "/uatf-auth-service/secret").with(admin())).andExpect(status().isConflict());
        assertThat(identityClients.findClient("dss-bff")).get().extracting(IdentityClient::enabled).isEqualTo(true);

        IdentityClient bff = identityClients.findClient("dss-bff").orElseThrow();
        mockMvc.perform(patch(CLIENTS + "/dss-bff").with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("description", "BFF de los portales DSS"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("BFF de los portales DSS"))
                .andExpect(jsonPath("$.redirectUris").value(org.hamcrest.Matchers.containsInAnyOrder(
                        bff.redirectUris().toArray())));
    }

    @Test
    @DisplayName("Lists and searches clients, marking system ones; unknown clients are 404")
    void listsClients() throws Exception {
        mockMvc.perform(get(CLIENTS).with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].clientId").value(hasItem("dss-bff")))
                .andExpect(jsonPath("$[?(@.clientId == 'dss-permissions')].type").value(hasItem("BEARER_ONLY")))
                .andExpect(jsonPath("$[?(@.clientId == 'dss-bff')].system").value(hasItem(true)));
        mockMvc.perform(get(CLIENTS).param("search", "olap").with(admin()))
                .andExpect(jsonPath("$[*].clientId").value(org.hamcrest.Matchers.contains("olap-service")));
        mockMvc.perform(get(CLIENTS + "/no-existe").with(admin())).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Reads need iam:clients:read and writes iam:clients:write")
    void requiresPermissions() throws Exception {
        mockMvc.perform(get(CLIENTS).with(jwt().authorities(new SimpleGrantedAuthority("iam:roles:read"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(CLIENTS + "/dss-bff/secret").with(jwt().authorities(new SimpleGrantedAuthority("iam:clients:read"))))
                .andExpect(status().isForbidden());
    }
}
