package chronos.dw.admin.configuration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;

class DwControlJwtAuthenticationConverterTest {

    private static final String PERMISSIONS = "dss-permissions";

    private final DwControlJwtAuthenticationConverter converter = new DwControlJwtAuthenticationConverter(PERMISSIONS);

    @Test
    void mapsDwPermissionsFromTheCatalogClient() {
        Jwt jwt = token(Map.of(
                PERMISSIONS,
                Map.of(
                        "roles",
                        List.of("dw:closure:read", "dw:etl-monitor:read", "analytics:read", "iam:users:write"))));

        assertEquals(Set.of("dw:closure:read", "dw:etl-monitor:read"), authorities(jwt));
    }

    /** IAM-019: the old DW_* roles were retired; a stale token carrying them grants nothing. */
    @Test
    void ignoresTheRetiredLegacyRoles() {
        Jwt legacyOnly = token(Map.of(
                "dw-control-service",
                Map.of("roles", List.of("DW_CLOSURE_READ", "DW_CLOSURE_MANAGE", "DW_ETL_MONITOR_READ"))));
        Jwt both = token(Map.of(
                "dw-control-service",
                Map.of("roles", List.of("DW_CLOSURE_MANAGE")),
                PERMISSIONS,
                Map.of("roles", List.of("dw:closure:read"))));

        assertEquals(Set.of(), authorities(legacyOnly));
        assertEquals(Set.of("dw:closure:read"), authorities(both));
    }

    @Test
    void ignoresDwNamesOutsideTheCatalogAndInRealmRoles() {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .subject("user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .claim(
                        "resource_access",
                        Map.of(
                                "olap-service",
                                Map.of("roles", List.of("dw:closure:manage")),
                                "dw-control-service",
                                Map.of("roles", List.of("dw:closure:manage")),
                                // Old names under the catalog are not valid either.
                                PERMISSIONS,
                                Map.of("roles", List.of("DW_CLOSURE_MANAGE"))))
                .claim("realm_access", Map.of("roles", List.of("dw:closure:manage", "DW_CLOSURE_MANAGE")))
                .build();

        assertEquals(Set.of(), authorities(jwt));
    }

    @Test
    void toleratesMalformedResourceAccess() {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .subject("user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .claim("resource_access", Map.of(PERMISSIONS, Map.of("roles", "dw:closure:read")))
                .build();

        assertEquals(Set.of(), authorities(jwt));
    }

    @Test
    void rejectsTokensWithoutSubject() {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .claim("resource_access", Map.of())
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .build();

        assertThrows(BadJwtException.class, () -> converter.convert(jwt));
    }

    @Test
    void requiresThePermissionsClientId() {
        assertThrows(IllegalArgumentException.class, () -> new DwControlJwtAuthenticationConverter(" "));
        assertThrows(IllegalArgumentException.class, () -> new DwControlJwtAuthenticationConverter(null));
    }

    private Set<String> authorities(Jwt jwt) {
        return converter.convert(jwt).getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(name -> !name.startsWith("SCOPE_"))
                .collect(Collectors.toSet());
    }

    private static Jwt token(Map<String, Object> resourceAccess) {
        Instant now = Instant.now();
        return Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .subject("user-123")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("resource_access", resourceAccess)
                .claim("realm_access", Map.of("roles", List.of("SUPERADMIN")))
                .build();
    }
}
