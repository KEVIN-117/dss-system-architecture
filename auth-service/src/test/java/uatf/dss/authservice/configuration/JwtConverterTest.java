package uatf.dss.authservice.configuration;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class JwtConverterTest {

    private final JwtConverter converter = new JwtConverter("preferred_username", "dss-permissions");

    private static Jwt jwt(Consumer<Map<String, Object>> claims) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject("8f6c1a2e-0000-4000-8000-000000000001")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300));
        builder.claims(claims);
        return builder.build();
    }

    private Set<String> authorities(Jwt jwt) {
        AbstractAuthenticationToken token = converter.convert(jwt);
        return token.getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.toSet());
    }

    @Test
    void mapsPermissionsWithoutPrefixAndRealmRolesWithRolePrefix() {
        Jwt token = jwt(claims -> {
            claims.put("realm_access", Map.of("roles", List.of("SUPERADMIN", "offline_access")));
            claims.put("resource_access", Map.of(
                    "dss-permissions", Map.of("roles", List.of("iam:users:read", "iam:users:write"))));
            claims.put("scope", "openid profile");
        });

        assertThat(authorities(token)).containsExactlyInAnyOrder(
                "iam:users:read", "iam:users:write",
                "ROLE_SUPERADMIN", "ROLE_offline_access",
                "SCOPE_openid", "SCOPE_profile");
    }

    /** IAM-019: the legacy client roles were retired; a stale token carrying them grants nothing. */
    @Test
    void ignoresRolesOfOtherClientsIncludingTheRetiredLegacyOnes() {
        Jwt token = jwt(claims -> claims.put("resource_access", Map.of(
                "uatf-auth-service", Map.of("roles", List.of("DECANO", "DIRECTOR", "CONTEXT_READER")),
                "olap-service", Map.of("roles", List.of("OLAP_ADMIN")),
                "dw-control-service", Map.of("roles", List.of("DW_CLOSURE_MANAGE")))));

        assertThat(authorities(token)).isEmpty();
    }

    @Test
    void serviceAccountTokenCarriesContextReadPermission() {
        Jwt token = jwt(claims -> {
            claims.put("azp", "olap-service");
            claims.put("resource_access", Map.of("dss-permissions", Map.of("roles", List.of("context:read"))));
        });

        assertThat(authorities(token)).containsExactly("context:read");
    }

    @Test
    void toleratesMissingOrMalformedClaims() {
        assertThat(authorities(jwt(claims -> claims.put("azp", "dss-bff")))).isEmpty();
        assertThat(authorities(jwt(claims -> {
            claims.put("realm_access", "not-a-map");
            claims.put("resource_access", Map.of("dss-permissions", Map.of("roles", "not-a-list")));
        }))).isEmpty();
        assertThat(authorities(jwt(claims -> claims.put("realm_access",
                Map.of("roles", List.of("", 42, "RECTOR")))))).containsExactly("ROLE_RECTOR");
    }

    @Test
    void usesTheConfiguredPrincipalClaim() {
        assertThat(converter.convert(jwt(claims -> claims.put("preferred_username", "ana.decana"))).getName())
                .isEqualTo("ana.decana");
        assertThat(converter.convert(jwt(claims -> claims.put("azp", "olap-service"))).getName())
                .isEqualTo("8f6c1a2e-0000-4000-8000-000000000001");
    }

    @Test
    void permissionsClientIsConfigurable() {
        JwtConverter custom = new JwtConverter("preferred_username", "other-catalog");
        Jwt token = jwt(claims -> claims.put("resource_access", Map.of(
                "other-catalog", Map.of("roles", List.of("iam:audit:read")),
                "dss-permissions", Map.of("roles", List.of("iam:users:write")))));

        assertThat(custom.convert(token).getAuthorities()).extracting(GrantedAuthority::getAuthority)
                .containsExactly("iam:audit:read");
    }
}
