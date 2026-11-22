package chronos.dw.admin.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * URL rules through the real {@link DwControlJwtAuthenticationConverter} (a bearer token decoded by a stubbed
 * {@link JwtDecoder}): only the {@code dss-permissions} permissions open DW routes (IAM-011, IAM-019).
 *
 * <p>A request is "allowed" when security lets it reach the controller: whatever the controller answers (200, 400,
 * 404...), it is neither 401 nor 403.
 */
@ActiveProfiles("test")
@AutoConfigureMockMvc
@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:dwcontrol-authz;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
            "spring.datasource.username=sa",
            "spring.datasource.password=",
            "app.security.jwt.issuer-uri=http://localhost:8080/realms/uatf-dss-realm",
            "app.security.jwt.jwk-set-uri=http://localhost:8080/realms/uatf-dss-realm/protocol/openid-connect/certs",
            "app.security.jwt.audience=dw-control-service"
        })
class DwControlUrlAuthorizationTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    JwtDecoder jwtDecoder;

    private final Map<String, Map<String, Object>> tokens = new java.util.HashMap<>();

    @BeforeEach
    void decodeTestTokens() {
        when(jwtDecoder.decode(anyString())).thenAnswer(invocation -> jwt(tokens.get(invocation.getArgument(0))));
    }

    @Test
    void permissionsOpenTheirRoutes() throws Exception {
        assertThat(status(get("/api/v1/academic-closures"), permissions("dw:closure:read")))
                .matches(DwControlUrlAuthorizationTest::allowed);
        assertThat(status(post("/api/v1/academic-closures"), permissions("dw:closure:manage")))
                .matches(DwControlUrlAuthorizationTest::allowed);
        assertThat(status(post("/api/v1/academic-closures/1/reopen"), permissions("dw:closure:manage")))
                .matches(DwControlUrlAuthorizationTest::allowed);
        assertThat(status(get("/api/v1/etl/executions"), permissions("dw:etl-monitor:read")))
                .matches(DwControlUrlAuthorizationTest::allowed);
    }

    @Test
    void eachPermissionOpensOnlyItsOwnRoutes() throws Exception {
        assertThat(status(post("/api/v1/academic-closures"), permissions("dw:closure:read")))
                .isEqualTo(403);
        assertThat(status(get("/api/v1/etl/executions"), permissions("dw:closure:read", "dw:closure:manage")))
                .isEqualTo(403);
        assertThat(status(get("/api/v1/academic-closures"), permissions("analytics:read")))
                .isEqualTo(403);
        assertThat(status(get("/api/v1/unknown"), permissions("dw:closure:read")))
                .isEqualTo(403);
    }

    /** IAM-019: the old DW_* roles were retired and no longer open anything. */
    @Test
    void retiredLegacyRolesAreRejected() throws Exception {
        assertThat(status(get("/api/v1/academic-closures"), legacy("DW_CLOSURE_READ")))
                .isEqualTo(403);
        assertThat(status(post("/api/v1/academic-closures"), legacy("DW_CLOSURE_MANAGE")))
                .isEqualTo(403);
        assertThat(status(get("/api/v1/etl/executions"), legacy("DW_ETL_MONITOR_READ")))
                .isEqualTo(403);
    }

    @Test
    void requestsWithoutTokenAreUnauthorized() throws Exception {
        assertThat(mockMvc.perform(get("/api/v1/academic-closures"))
                        .andReturn()
                        .getResponse()
                        .getStatus())
                .isEqualTo(401);
    }

    private int status(MockHttpServletRequestBuilder request, Map<String, Object> resourceAccess) throws Exception {
        String token = "token-" + tokens.size();
        tokens.put(token, resourceAccess);
        return mockMvc.perform(request.header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andReturn()
                .getResponse()
                .getStatus();
    }

    private static Map<String, Object> permissions(String... names) {
        return Map.of("dss-permissions", Map.of("roles", List.of(names)));
    }

    private static Map<String, Object> legacy(String... names) {
        return Map.of("dw-control-service", Map.of("roles", List.of(names)));
    }

    private static boolean allowed(int status) {
        return status != 401 && status != 403;
    }

    private static Jwt jwt(Map<String, Object> resourceAccess) {
        Instant now = Instant.now();
        return Jwt.withTokenValue("t")
                .header("alg", "none")
                .subject("operator-1")
                .audience(List.of("dw-control-service"))
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("resource_access", resourceAccess == null ? Map.of() : resourceAccess)
                .build();
    }
}
