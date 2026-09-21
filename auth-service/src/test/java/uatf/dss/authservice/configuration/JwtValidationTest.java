package uatf.dss.authservice.configuration;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JwtValidationTest {

    private static final String ISSUER = "https://keycloak.example.test/realms/uatf";
    private static final String AUDIENCE = "uatf-auth-service";

    @Test
    void shouldAcceptTokenWithExpectedIssuerAndAudience() {
        assertThat(SecurityConfig.jwtValidator(ISSUER, AUDIENCE).validate(jwt(ISSUER, List.of(AUDIENCE))).hasErrors())
                .isFalse();
    }

    @Test
    void shouldRejectTokenWithUnexpectedIssuer() {
        assertThat(SecurityConfig.jwtValidator(ISSUER, AUDIENCE)
                .validate(jwt("https://keycloak.example.test/realms/other", List.of(AUDIENCE)))
                .hasErrors())
                .isTrue();
    }

    @Test
    void shouldRejectTokenWithoutExpectedAudience() {
        assertThat(SecurityConfig.jwtValidator(ISSUER, AUDIENCE)
                .validate(jwt(ISSUER, List.of("another-service")))
                .hasErrors())
                .isTrue();
    }

    private Jwt jwt(String issuer, List<String> audience) {
        Instant now = Instant.now();
        return Jwt.withTokenValue("token")
                .header("alg", "none")
                .issuer(issuer)
                .audience(audience)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(60))
                .build();
    }
}
