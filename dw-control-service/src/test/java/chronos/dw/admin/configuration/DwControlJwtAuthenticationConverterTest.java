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

    private final DwControlJwtAuthenticationConverter converter =
            new DwControlJwtAuthenticationConverter("dw-control-service");

    @Test
    void mapsOnlyPermissionsFromTheDwControlClient() {
        Jwt jwt = token(
                "user-123",
                Map.of(
                        "dw-control-service", Map.of("roles", List.of("DW_CLOSURE_READ", "DW_ETL_MONITOR_READ")),
                        "olap-service", Map.of("roles", List.of("DW_CLOSURE_MANAGE"))),
                Map.of("roles", List.of("DW_CLOSURE_MANAGE")));

        Set<String> authorities = converter.convert(jwt).getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .collect(Collectors.toSet());

        assertEquals(Set.of("DW_CLOSURE_READ", "DW_ETL_MONITOR_READ"), authorities);
    }

    @Test
    void rejectsTokensWithoutSubject() {
        Jwt jwt = token(null, Map.of(), Map.of());

        assertThrows(BadJwtException.class, () -> converter.convert(jwt));
    }

    private Jwt token(String subject, Map<String, Object> resourceAccess, Map<String, Object> realmAccess) {
        Instant now = Instant.now();
        return Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .subject(subject)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("resource_access", resourceAccess)
                .claim("realm_access", realmAccess)
                .build();
    }
}
