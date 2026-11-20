package uatf.dss.authservice.adapter.out.keycloak;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import uatf.dss.authservice.domain.exception.conflict.IdentityResourceConflictException;
import uatf.dss.authservice.domain.exception.notfound.IdentityResourceNotFoundException;
import uatf.dss.authservice.domain.exception.upstream.IdentityProviderException;
import uatf.dss.authservice.domain.exception.upstream.IdentityProviderUnavailableException;
import uatf.dss.authservice.domain.exception.validation.IdentityRequestRejectedException;
import uatf.dss.authservice.domain.model.identity.IdentityRoleDraft;

import java.io.IOException;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class KeycloakAdminHttpClientTest {

    private static final String BASE = "http://keycloak.test";
    private static final String TOKEN_URL = BASE + "/realms/uatf-dss-realm/protocol/openid-connect/token";
    private static final String ADMIN = BASE + "/admin/realms/uatf-dss-realm";

    private MockRestServiceServer server;
    private MutableClock clock;
    private List<Duration> sleeps;
    private KeycloakAdminHttpClient http;
    private KeycloakAdminTokenProvider tokens;

    @BeforeEach
    void setUp() {
        setUp(properties("s3cr3t"));
    }

    private void setUp(KeycloakAdminProperties properties) {
        RestClient.Builder builder = RestClient.builder().baseUrl(BASE);
        server = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.build();
        clock = new MutableClock(Instant.parse("2026-11-19T12:00:00Z"));
        sleeps = new ArrayList<>();
        tokens = new KeycloakAdminTokenProvider(restClient, properties, clock);
        http = new KeycloakAdminHttpClient(restClient, tokens, properties, sleeps::add);
    }

    private static KeycloakAdminProperties properties(String secret) {
        return new KeycloakAdminProperties(BASE, "uatf-dss-realm", "uatf-auth-service", secret,
                Duration.ofSeconds(1), Duration.ofSeconds(1), 2, Duration.ofMillis(100), Duration.ofSeconds(30));
    }

    private void expectToken(String token, int expiresIn) {
        server.expect(ExpectedCount.once(), requestTo(TOKEN_URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_FORM_URLENCODED))
                .andExpect(content().formDataContains(Map.of(
                        "grant_type", "client_credentials", "client_id", "uatf-auth-service", "client_secret", "s3cr3t")))
                .andRespond(withSuccess("{\"access_token\":\"" + token + "\",\"expires_in\":" + expiresIn + "}",
                        MediaType.APPLICATION_JSON));
    }

    private KeycloakAdminHttpClient.Call getRole() {
        return KeycloakAdminHttpClient.Call.of(HttpMethod.GET, "obtener rol DIRECTOR", "/roles/{role}", "DIRECTOR");
    }

    private static final String ROLE_JSON = "{\"id\":\"r1\",\"name\":\"DIRECTOR\",\"unknownField\":1}";

    @Test
    void reusesTheTokenUntilShortlyBeforeItExpires() {
        expectToken("t1", 300);
        server.expect(ExpectedCount.twice(), requestTo(ADMIN + "/roles/DIRECTOR"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer t1"))
                .andRespond(withSuccess(ROLE_JSON, MediaType.APPLICATION_JSON));
        expectToken("t2", 300);
        server.expect(requestTo(ADMIN + "/roles/DIRECTOR"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer t2"))
                .andRespond(withSuccess(ROLE_JSON, MediaType.APPLICATION_JSON));

        http.fetch(getRole(), KeycloakRepresentations.RoleRepresentation.class);
        clock.advance(Duration.ofSeconds(269));
        http.fetch(getRole(), KeycloakRepresentations.RoleRepresentation.class);
        clock.advance(Duration.ofSeconds(2)); // 271 s > 300 s - 30 s skew
        KeycloakRepresentations.RoleRepresentation role = http.fetch(getRole(), KeycloakRepresentations.RoleRepresentation.class);

        assertThat(role.name()).isEqualTo("DIRECTOR");
        server.verify();
    }

    @Test
    void renewsTheTokenOnceWhenKeycloakAnswers401() {
        expectToken("expired", 300);
        server.expect(requestTo(ADMIN + "/roles/DIRECTOR"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer expired"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));
        expectToken("fresh", 300);
        server.expect(requestTo(ADMIN + "/roles/DIRECTOR"))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer fresh"))
                .andRespond(withSuccess(ROLE_JSON, MediaType.APPLICATION_JSON));

        assertThat(http.fetch(getRole(), KeycloakRepresentations.RoleRepresentation.class).id()).isEqualTo("r1");
        server.verify();
    }

    @Test
    void persistent401AfterRenewalIsReportedAsMissingPrivileges() {
        expectToken("t1", 300);
        server.expect(requestTo(ADMIN + "/roles/DIRECTOR")).andRespond(withStatus(HttpStatus.UNAUTHORIZED));
        expectToken("t2", 300);
        server.expect(requestTo(ADMIN + "/roles/DIRECTOR")).andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        assertThatThrownBy(() -> http.fetch(getRole(), KeycloakRepresentations.RoleRepresentation.class))
                .isInstanceOf(IdentityProviderException.class)
                .hasMessageContaining("privilegios");
    }

    @Test
    void retriesIdempotentCallsOnGatewayErrorsWithExponentialBackoff() {
        expectToken("t1", 300);
        server.expect(requestTo(ADMIN + "/roles/DIRECTOR")).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        server.expect(requestTo(ADMIN + "/roles/DIRECTOR")).andRespond(withStatus(HttpStatus.BAD_GATEWAY));
        server.expect(requestTo(ADMIN + "/roles/DIRECTOR")).andRespond(withSuccess(ROLE_JSON, MediaType.APPLICATION_JSON));

        assertThat(http.fetch(getRole(), KeycloakRepresentations.RoleRepresentation.class).name()).isEqualTo("DIRECTOR");
        assertThat(sleeps).containsExactly(Duration.ofMillis(100), Duration.ofMillis(200));
        server.verify();
    }

    @Test
    void givesUpAfterMaxRetriesOnIoErrorsWith503() {
        expectToken("t1", 300);
        server.expect(ExpectedCount.times(3), requestTo(ADMIN + "/roles/DIRECTOR"))
                .andRespond(withException(new IOException("connection reset")));

        assertThatThrownBy(() -> http.fetch(getRole(), KeycloakRepresentations.RoleRepresentation.class))
                .isInstanceOf(IdentityProviderUnavailableException.class)
                .satisfies(e -> assertThat(((IdentityProviderUnavailableException) e).getHttpStatus()).isEqualTo(503));
        server.verify();
    }

    @Test
    void neverRetriesPostBecauseItsOutcomeIsUnknown() {
        expectToken("t1", 300);
        server.expect(ExpectedCount.once(), requestTo(ADMIN + "/roles"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        assertThatThrownBy(() -> http.create(KeycloakAdminHttpClient.Call.of(HttpMethod.POST, "crear rol X", "/roles")
                .body(KeycloakMappers.toRepresentation(new IdentityRoleDraft("X", null, null)))))
                .isInstanceOf(IdentityProviderException.class)
                .satisfies(e -> assertThat(((IdentityProviderException) e).getHttpStatus()).isEqualTo(502));
        assertThat(sleeps).isEmpty();
        server.verify();
    }

    @Test
    void translatesClientErrorsAndKeepsKeycloakReason() {
        expectToken("t1", 300);
        server.expect(requestTo(ADMIN + "/roles/DIRECTOR")).andRespond(withStatus(HttpStatus.NOT_FOUND)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error\":\"Could not find role\"}"));
        server.expect(requestTo(ADMIN + "/users")).andRespond(withStatus(HttpStatus.CONFLICT)
                .contentType(MediaType.APPLICATION_JSON).body("{\"errorMessage\":\"User exists with same username\"}"));
        server.expect(requestTo(ADMIN + "/users")).andRespond(withStatus(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON).body("{\"errorMessage\":\"error-invalid-email\"}"));
        server.expect(requestTo(ADMIN + "/roles/DIRECTOR")).andRespond(withStatus(HttpStatus.FORBIDDEN));

        assertThatThrownBy(() -> http.fetch(getRole(), KeycloakRepresentations.RoleRepresentation.class))
                .isInstanceOf(IdentityResourceNotFoundException.class);
        KeycloakAdminHttpClient.Call createUser = KeycloakAdminHttpClient.Call.of(HttpMethod.POST, "crear usuario ana", "/users")
                .body(Map.of("username", "ana"));
        assertThatThrownBy(() -> http.create(createUser))
                .isInstanceOf(IdentityResourceConflictException.class)
                .hasMessageContaining("User exists with same username");
        assertThatThrownBy(() -> http.create(createUser))
                .isInstanceOf(IdentityRequestRejectedException.class)
                .hasMessageContaining("error-invalid-email");
        assertThatThrownBy(() -> http.fetch(getRole(), KeycloakRepresentations.RoleRepresentation.class))
                .isInstanceOf(IdentityProviderException.class)
                .hasMessageContaining("privilegios");
        server.verify();
    }

    @Test
    void createReturnsTheIdFromTheLocationHeaderAndSendsUtf8Json() {
        expectToken("t1", 300);
        server.expect(requestTo(ADMIN + "/roles"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json("{\"name\":\"DIRECTOR\",\"description\":\"Autoridad académica de una carrera\"}"))
                .andRespond(withStatus(HttpStatus.CREATED).location(URI.create(ADMIN + "/roles/abc-123")));

        String id = http.create(KeycloakAdminHttpClient.Call.of(HttpMethod.POST, "crear rol", "/roles")
                .body(KeycloakMappers.toRepresentation(
                        new IdentityRoleDraft("DIRECTOR", "Autoridad académica de una carrera", null))));

        assertThat(id).isEqualTo("abc-123");
        server.verify();
    }

    @Test
    void rejectedServiceAccountCredentialsAreAnUpstreamError() {
        server.expect(requestTo(TOKEN_URL)).andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error\":\"unauthorized_client\"}"));

        assertThatThrownBy(() -> http.fetch(getRole(), KeycloakRepresentations.RoleRepresentation.class))
                .isInstanceOf(IdentityProviderException.class)
                .hasMessageContaining("credenciales");
    }

    @Test
    void missingSecretFailsWith503WithoutCallingKeycloak() {
        setUp(properties(" "));

        assertThatThrownBy(() -> http.fetch(getRole(), KeycloakRepresentations.RoleRepresentation.class))
                .isInstanceOf(IdentityProviderUnavailableException.class)
                .hasMessageContaining("KEYCLOAK_AUTH_SERVICE_CLIENT_SECRET");
        server.verify();
    }

    @Test
    void secretsAreNeverPrinted() {
        assertThat(properties("s3cr3t").toString()).doesNotContain("s3cr3t").contains("clientSecret=****");
        assertThat(properties(null).toString()).contains("clientSecret=<unset>");
        assertThat(new KeycloakRepresentations.TokenResponse("eyJ.secret.token", 60L).toString()).doesNotContain("eyJ");
        assertThat(new KeycloakRepresentations.CredentialRepresentation("secret", "abc").toString()).doesNotContain("abc");
    }

    @Test
    void appliesSafeDefaults() {
        KeycloakAdminProperties defaults = new KeycloakAdminProperties("http://kc:8080/", null, null, null,
                null, null, null, null, null);
        assertThat(defaults.baseUrl()).isEqualTo("http://kc:8080");
        assertThat(defaults.realm()).isEqualTo("uatf-dss-realm");
        assertThat(defaults.clientId()).isEqualTo("uatf-auth-service");
        assertThat(defaults.readTimeout()).isEqualTo(Duration.ofSeconds(5));
        assertThat(defaults.maxRetries()).isEqualTo(2);
        assertThat(defaults.hasClientSecret()).isFalse();
    }

    static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneOffset getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
