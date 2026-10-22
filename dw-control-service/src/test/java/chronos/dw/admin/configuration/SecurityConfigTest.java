package chronos.dw.admin.configuration;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class SecurityConfigTest {

    private static final String ISSUER = "http://keycloak/realms/uatf-dss-realm";
    private static final String AUDIENCE = "dw-control-service";

    @Test
    void acceptsTokensOnlyWhenIssuerAndServiceAudienceMatch() {
        assertFalse(SecurityConfig.jwtValidator(ISSUER, AUDIENCE)
                .validate(token(ISSUER, List.of(AUDIENCE)))
                .hasErrors());
        assertTrue(SecurityConfig.jwtValidator(ISSUER, AUDIENCE)
                .validate(token("http://untrusted/realms/other", List.of(AUDIENCE)))
                .hasErrors());
        assertTrue(SecurityConfig.jwtValidator(ISSUER, AUDIENCE)
                .validate(token(ISSUER, List.of("another-service")))
                .hasErrors());
    }

    private Jwt token(String issuer, List<String> audiences) {
        Instant now = Instant.now();
        return Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .issuer(issuer)
                .audience(audiences)
                .subject("user-123")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .build();
    }
}
