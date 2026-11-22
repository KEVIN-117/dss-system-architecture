/*
 * Copyright 2026 Spicule Ltd
 * Apache License, Version 2.0.
 */
package org.saiku.web.security.keycloak;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.Test;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

public class SaikuKeycloakJwtAuthenticationConverterTest {

    private final SaikuKeycloakJwtAuthenticationConverter converter = new SaikuKeycloakJwtAuthenticationConverter();

    private static Jwt token(Map<String, Object> realmAccess, Map<String, Object> resourceAccess) {
        return Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .issuer("https://identity.example/realms/uatf")
                .subject("subject-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .claim("scope", "openid olap.read")
                .claim("realm_access", realmAccess)
                .claim("resource_access", resourceAccess)
                .build();
    }

    private Set<String> authorities(Jwt jwt) {
        return authorities(converter, jwt);
    }

    private static Set<String> authorities(SaikuKeycloakJwtAuthenticationConverter converter, Jwt jwt) {
        return converter.convert(jwt).getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .collect(Collectors.toSet());
    }

    @Test
    public void maps_realm_roles_permissions_and_scope_to_saiku_authorities() {
        Jwt jwt = token(
                Map.of("roles", List.of("RECTOR")),
                Map.of(
                        "dss-permissions", Map.of("roles", List.of("olap:user")),
                        "auth-service", Map.of("roles", List.of("unrelated"))));

        JwtAuthenticationToken authentication = (JwtAuthenticationToken) converter.convert(jwt);
        Set<String> authorities = authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .collect(Collectors.toSet());

        assertEquals("subject-123", authentication.getName());
        assertTrue("realm roles keep their authority (Mondrian roles)", authorities.contains("ROLE_RECTOR"));
        assertTrue(authorities.contains("ROLE_USER"));
        assertTrue(authorities.contains("SCOPE_openid"));
        assertTrue(authorities.contains("SCOPE_olap.read"));
        assertFalse(authorities.contains("ROLE_UNRELATED"));
    }

    @Test
    public void rejects_token_without_subject() {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .build();

        try {
            converter.convert(jwt);
            fail("expected a token without sub to be rejected");
        } catch (BadJwtException expected) {
            // A missing immutable identity must never become an authenticated Saiku user.
        }
    }

    @Test
    public void maps_dss_permissions_to_saiku_admin_and_user() {
        Jwt admin = token(
                Map.of("roles", List.of("RECTOR")),
                Map.of("dss-permissions", Map.of("roles", List.of("olap:admin", "analytics:read"))));
        Jwt user = token(Map.of(), Map.of("dss-permissions", Map.of("roles", List.of("olap:user"))));

        Set<String> adminAuthorities = authorities(admin);
        assertTrue(adminAuthorities.contains("ROLE_ADMIN"));
        assertFalse(adminAuthorities.contains("ROLE_USER"));
        assertFalse("other permissions are not Saiku authorities", adminAuthorities.contains("ROLE_ANALYTICS:READ"));
        assertTrue(authorities(user).contains("ROLE_USER"));
        assertFalse(authorities(user).contains("ROLE_ADMIN"));
    }

    @Test
    public void retired_olap_client_roles_grant_nothing() {
        // IAM-019: OLAP_ADMIN / OLAP_USER of olap-service were retired; a stale token carrying them is not trusted.
        Jwt legacyOnly = token(
                Map.of("roles", List.of("SUPERADMIN")),
                Map.of("olap-service", Map.of("roles", List.of("OLAP_ADMIN", "OLAP_USER", "ROLE_ANALYST"))));

        Set<String> authorities = authorities(legacyOnly);

        assertFalse(authorities.contains("ROLE_ADMIN"));
        assertFalse(authorities.contains("ROLE_USER"));
        assertFalse(authorities.contains("ROLE_OLAP_ADMIN"));
        assertFalse(authorities.contains("ROLE_ANALYST"));
        assertTrue(authorities.contains("ROLE_SUPERADMIN"));
    }

    @Test
    public void legacy_roles_next_to_permissions_add_nothing() {
        Jwt jwt = token(
                Map.of(),
                Map.of(
                        "olap-service", Map.of("roles", List.of("OLAP_ADMIN")),
                        "dss-permissions", Map.of("roles", List.of("olap:user"))));

        Set<String> authorities = authorities(jwt);

        assertTrue(authorities.contains("ROLE_USER"));
        assertFalse(authorities.contains("ROLE_ADMIN"));
    }

    @Test
    public void superadmin_without_olap_admin_is_not_a_saiku_administrator() {
        // D4: administration is its own permission; the platform administrator has no implicit OLAP admin.
        Jwt jwt = token(
                Map.of("roles", List.of("SUPERADMIN")),
                Map.of("dss-permissions", Map.of("roles", List.of("iam:users:write", "iam:roles:write"))));

        Set<String> authorities = authorities(jwt);
        assertTrue(authorities.contains("ROLE_SUPERADMIN"));
        assertFalse(authorities.contains("ROLE_ADMIN"));
    }

    @Test
    public void realm_roles_named_like_saiku_authorities_grant_nothing() {
        // Realm roles can be created from the admin API (IAM-007); a role called ADMIN must not be a backdoor.
        Jwt jwt = token(Map.of("roles", List.of("admin", "ROLE_ADMIN", "USER", "DECANO")), Map.of());

        Set<String> authorities = authorities(jwt);
        assertFalse(authorities.contains("ROLE_ADMIN"));
        assertFalse(authorities.contains("ROLE_USER"));
        assertTrue(authorities.contains("ROLE_DECANO"));
    }

    @Test
    public void permissions_only_count_under_the_catalog_client() {
        Jwt jwt = token(
                Map.of("roles", List.of("olap:admin")),
                Map.of(
                        "olap-service", Map.of("roles", List.of("olap:admin")),
                        "uatf-auth-service", Map.of("roles", List.of("olap:admin", "OLAP_ADMIN"))));

        assertFalse(authorities(jwt).contains("ROLE_ADMIN"));
    }

    @Test
    public void the_catalog_client_is_configurable() {
        SaikuKeycloakJwtAuthenticationConverter converter = new SaikuKeycloakJwtAuthenticationConverter();
        converter.setPermissionsClientId(" catalog ");
        converter.setPermissionsClientId(" ");

        Jwt jwt = token(Map.of(), Map.of("catalog", Map.of("roles", List.of("olap:admin"))));

        assertTrue(authorities(converter, jwt).contains("ROLE_ADMIN"));
    }

    @Test
    public void does_not_grant_saiku_admin_from_another_clients_olap_admin_role() {
        Jwt jwt = token(
                Map.of("roles", List.of("SUPERADMIN")),
                Map.of("uatf-auth-service", Map.of("roles", List.of("OLAP_ADMIN"))));

        Set<String> authorities = authorities(jwt);

        assertTrue(authorities.contains("ROLE_SUPERADMIN"));
        assertFalse(authorities.contains("ROLE_ADMIN"));
        assertFalse(authorities.contains("ROLE_OLAP_ADMIN"));
    }
}
