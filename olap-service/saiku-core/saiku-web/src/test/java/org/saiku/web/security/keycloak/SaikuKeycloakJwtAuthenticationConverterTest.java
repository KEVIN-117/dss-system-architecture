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

    @Test
    public void maps_keycloak_roles_and_scope_to_saiku_authorities() {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .issuer("https://identity.example/realms/uatf")
                .subject("subject-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .claim("scope", "openid olap.read")
                .claim("realm_access", Map.of("roles", List.of("admin")))
                .claim(
                        "resource_access",
                        Map.of(
                                "olap-service", Map.of("roles", List.of("user", "ROLE_ANALYST")),
                                "auth-service", Map.of("roles", List.of("unrelated"))))
                .build();

        JwtAuthenticationToken authentication = (JwtAuthenticationToken) converter.convert(jwt);
        Set<String> authorities = authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .collect(Collectors.toSet());

        assertEquals("subject-123", authentication.getName());
        assertTrue(authorities.contains("ROLE_ADMIN"));
        assertTrue(authorities.contains("ROLE_USER"));
        assertTrue(authorities.contains("ROLE_ANALYST"));
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
    public void maps_olap_client_roles_to_saiku_legacy_authorities() {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .subject("subject-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .claim("realm_access", Map.of("roles", List.of("SUPERADMIN")))
                .claim(
                        "resource_access",
                        Map.of(
                                "olap-service", Map.of("roles", List.of("OLAP_ADMIN", "OLAP_USER")),
                                "uatf-auth-service", Map.of("roles", List.of("OLAP_ADMIN"))))
                .build();

        JwtAuthenticationToken authentication = (JwtAuthenticationToken) converter.convert(jwt);
        Set<String> authorities = authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .collect(Collectors.toSet());

        assertTrue(authorities.contains("ROLE_OLAP_ADMIN"));
        assertTrue(authorities.contains("ROLE_OLAP_USER"));
        assertTrue(authorities.contains("ROLE_ADMIN"));
        assertTrue(authorities.contains("ROLE_USER"));
        assertTrue(authorities.contains("ROLE_SUPERADMIN"));
    }

    @Test
    public void does_not_grant_saiku_admin_from_another_clients_olap_admin_role() {
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "RS256")
                .subject("subject-123")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .claim("realm_access", Map.of("roles", List.of("SUPERADMIN")))
                .claim("resource_access", Map.of("uatf-auth-service", Map.of("roles", List.of("OLAP_ADMIN"))))
                .build();

        JwtAuthenticationToken authentication = (JwtAuthenticationToken) converter.convert(jwt);
        Set<String> authorities = authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .collect(Collectors.toSet());

        assertTrue(authorities.contains("ROLE_SUPERADMIN"));
        assertFalse(authorities.contains("ROLE_ADMIN"));
        assertFalse(authorities.contains("ROLE_OLAP_ADMIN"));
    }
}
