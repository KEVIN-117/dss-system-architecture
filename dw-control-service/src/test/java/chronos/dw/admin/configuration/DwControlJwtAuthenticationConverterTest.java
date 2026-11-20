package chronos.dw.admin.configuration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
    private static final String LEGACY = "dw-control-service";

    private final DwControlJwtAuthenticationConverter coexistence =
            new DwControlJwtAuthenticationConverter(PERMISSIONS, LEGACY, true);
    private final DwControlJwtAuthenticationConverter permissionsOnly =
            new DwControlJwtAuthenticationConverter(PERMISSIONS, LEGACY, false);

    @Test
    void mapsDwPermissionsFromTheCatalogClient() {
        Jwt jwt = token(Map.of(
                PERMISSIONS,
                Map.of(
                        "roles",
                        List.of("dw:closure:read", "dw:etl-monitor:read", "analytics:read", "iam:users:write"))));

        assertEquals(Set.of("dw:closure:read", "dw:etl-monitor:read"), authorities(permissionsOnly, jwt));
        assertEquals(Set.of("dw:closure:read", "dw:etl-monitor:read"), authorities(coexistence, jwt));
    }

    @Test
    void duringCoexistenceLegacyRolesAreTranslatedToThePermissionNames() {
        Jwt jwt = token(Map.of(
                LEGACY,
                        Map.of(
                                "roles",
                                List.of("DW_CLOSURE_READ", "DW_CLOSURE_MANAGE", "DW_ETL_MONITOR_READ", "OTHER")),
                PERMISSIONS, Map.of("roles", List.of("dw:closure:read"))));

        assertEquals(
                Set.of("dw:closure:read", "dw:closure:manage", "dw:etl-monitor:read"), authorities(coexistence, jwt));
        assertTrue(coexistence.legacyRolesEnabled());
    }

    @Test
    void withCoexistenceOffOnlyTheNewPermissionsAreAccepted() {
        Jwt legacyOnly = token(Map.of(LEGACY, Map.of("roles", List.of("DW_CLOSURE_READ", "DW_CLOSURE_MANAGE"))));
        Jwt both = token(Map.of(
                LEGACY, Map.of("roles", List.of("DW_CLOSURE_MANAGE")),
                PERMISSIONS, Map.of("roles", List.of("dw:closure:read"))));

        assertEquals(Set.of(), authorities(permissionsOnly, legacyOnly));
        assertEquals(Set.of("dw:closure:read"), authorities(permissionsOnly, both));
        assertFalse(permissionsOnly.legacyRolesEnabled());
    }

    @Test
    void ignoresDwNamesOutsideTheirClientAndInRealmRoles() {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .subject("user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .claim(
                        "resource_access",
                        Map.of(
                                "olap-service",
                                Map.of("roles", List.of("dw:closure:manage", "DW_CLOSURE_MANAGE")),
                                // New names under the legacy client and old names under the catalog are not valid.
                                LEGACY,
                                Map.of("roles", List.of("dw:closure:manage")),
                                PERMISSIONS,
                                Map.of("roles", List.of("DW_CLOSURE_MANAGE"))))
                .claim("realm_access", Map.of("roles", List.of("dw:closure:manage", "DW_CLOSURE_MANAGE")))
                .build();

        assertEquals(Set.of(), authorities(coexistence, jwt));
    }

    @Test
    void toleratesMalformedResourceAccess() {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .subject("user-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .claim("resource_access", Map.of(PERMISSIONS, Map.of("roles", "dw:closure:read"), LEGACY, "x"))
                .build();

        assertEquals(Set.of(), authorities(coexistence, jwt));
    }

    @Test
    void rejectsTokensWithoutSubject() {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .claim("resource_access", Map.of())
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .build();

        assertThrows(BadJwtException.class, () -> coexistence.convert(jwt));
    }

    @Test
    void requiresTheClientIds() {
        assertThrows(IllegalArgumentException.class, () -> new DwControlJwtAuthenticationConverter(" ", LEGACY, true));
        assertThrows(
                IllegalArgumentException.class, () -> new DwControlJwtAuthenticationConverter(PERMISSIONS, null, true));
        // Without coexistence the legacy client is not needed.
        assertFalse(new DwControlJwtAuthenticationConverter(PERMISSIONS, null, false).legacyRolesEnabled());
    }

    private static Set<String> authorities(DwControlJwtAuthenticationConverter converter, Jwt jwt) {
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
