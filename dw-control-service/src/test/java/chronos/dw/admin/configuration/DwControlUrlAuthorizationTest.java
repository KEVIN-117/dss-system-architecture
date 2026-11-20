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
import org.junit.jupiter.api.Nested;
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
 * {@link JwtDecoder}), with both permission formats and with the coexistence flag on and off (IAM-011).
 *
 * <p>A request is "allowed" when security lets it reach the controller: whatever the controller answers (200, 400,
 * 404...), it is neither 401 nor 403.
 */
class DwControlUrlAuthorizationTest {

    private static final String DB =
            "spring.datasource.url=jdbc:h2:mem:dwcontrol-authz;DB_CLOSE_DELAY=-1;MODE=PostgreSQL";

    abstract static class Base {

        @Autowired
        MockMvc mockMvc;

        @MockitoBean
        JwtDecoder jwtDecoder;

        private final Map<String, Map<String, Object>> tokens = new java.util.HashMap<>();

        @BeforeEach
        void decodeTestTokens() {
            when(jwtDecoder.decode(anyString())).thenAnswer(invocation -> jwt(tokens.get(invocation.getArgument(0))));
        }

        int status(MockHttpServletRequestBuilder request, Map<String, Object> resourceAccess) throws Exception {
            String token = "token-" + tokens.size();
            tokens.put(token, resourceAccess);
            return mockMvc.perform(request.header("Authorization", "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andReturn()
                    .getResponse()
                    .getStatus();
        }

        static Map<String, Object> permissions(String... names) {
            return Map.of("dss-permissions", Map.of("roles", List.of(names)));
        }

        static Map<String, Object> legacy(String... names) {
            return Map.of("dw-control-service", Map.of("roles", List.of(names)));
        }

        static boolean allowed(int status) {
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

    @Nested
    @ActiveProfiles("test")
    @AutoConfigureMockMvc
    @SpringBootTest(
            properties = {
                DB,
                "spring.datasource.username=sa",
                "spring.datasource.password=",
                "app.security.jwt.issuer-uri=http://localhost:8080/realms/uatf-dss-realm",
                "app.security.jwt.jwk-set-uri=http://localhost:8080/realms/uatf-dss-realm/protocol/openid-connect/certs",
                "app.security.jwt.audience=dw-control-service",
                "app.security.jwt.client-id=dw-control-service",
                "app.security.legacy-dw-roles-enabled=true"
            })
    class WithCoexistence extends Base {

        @Test
        void newPermissionsOpenTheirRoutes() throws Exception {
            assertThat(status(get("/api/v1/academic-closures"), permissions("dw:closure:read")))
                    .matches(Base::allowed);
            assertThat(status(post("/api/v1/academic-closures"), permissions("dw:closure:manage")))
                    .matches(Base::allowed);
            assertThat(status(get("/api/v1/etl/executions"), permissions("dw:etl-monitor:read")))
                    .matches(Base::allowed);
        }

        @Test
        void legacyRolesStillOpenTheirRoutes() throws Exception {
            assertThat(status(get("/api/v1/academic-closures"), legacy("DW_CLOSURE_READ")))
                    .matches(Base::allowed);
            assertThat(status(post("/api/v1/academic-closures/1/close"), legacy("DW_CLOSURE_MANAGE")))
                    .matches(Base::allowed);
            assertThat(status(get("/api/v1/etl/executions/run-1"), legacy("DW_ETL_MONITOR_READ")))
                    .matches(Base::allowed);
        }

        @Test
        void eachPermissionOpensOnlyItsOwnRoutes() throws Exception {
            assertThat(status(post("/api/v1/academic-closures"), permissions("dw:closure:read")))
                    .isEqualTo(403);
            assertThat(status(get("/api/v1/etl/executions"), legacy("DW_CLOSURE_READ", "DW_CLOSURE_MANAGE")))
                    .isEqualTo(403);
            assertThat(status(get("/api/v1/academic-closures"), permissions("analytics:read")))
                    .isEqualTo(403);
            assertThat(status(get("/api/v1/unknown"), permissions("dw:closure:read")))
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
    }

    @Nested
    @ActiveProfiles("test")
    @AutoConfigureMockMvc
    @SpringBootTest(
            properties = {
                DB,
                "spring.datasource.username=sa",
                "spring.datasource.password=",
                "app.security.jwt.issuer-uri=http://localhost:8080/realms/uatf-dss-realm",
                "app.security.jwt.jwk-set-uri=http://localhost:8080/realms/uatf-dss-realm/protocol/openid-connect/certs",
                "app.security.jwt.audience=dw-control-service",
                "app.security.jwt.client-id=dw-control-service",
                "app.security.legacy-dw-roles-enabled=false"
            })
    class PermissionsOnly extends Base {

        @Test
        void legacyRolesAreRejected() throws Exception {
            assertThat(status(get("/api/v1/academic-closures"), legacy("DW_CLOSURE_READ")))
                    .isEqualTo(403);
            assertThat(status(post("/api/v1/academic-closures"), legacy("DW_CLOSURE_MANAGE")))
                    .isEqualTo(403);
            assertThat(status(get("/api/v1/etl/executions"), legacy("DW_ETL_MONITOR_READ")))
                    .isEqualTo(403);
        }

        @Test
        void newPermissionsStillWork() throws Exception {
            assertThat(status(get("/api/v1/academic-closures"), permissions("dw:closure:read")))
                    .matches(Base::allowed);
            assertThat(status(post("/api/v1/academic-closures/1/reopen"), permissions("dw:closure:manage")))
                    .matches(Base::allowed);
            assertThat(status(get("/api/v1/etl/executions"), permissions("dw:etl-monitor:read")))
                    .matches(Base::allowed);
        }
    }
}
