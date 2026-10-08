/*
 * Copyright 2026 Spicule Ltd
 * Apache License, Version 2.0.
 */
package org.saiku.web.service;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.After;
import org.junit.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

public class SessionServiceKeycloakIdentityTest {

    @After
    public void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    public void derives_request_identity_and_roles_from_keycloak_subject_without_password() {
        Jwt jwt = Jwt.withTokenValue("signed-token")
                .header("alg", "RS256")
                .issuer("https://identity.example/realms/uatf")
                .subject("d77a55e0-434a-41c8-9fa5-63feb910d108")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .claim("sid", "keycloak-session-123")
                .claim("preferred_username", "ana")
                .build();
        SecurityContextHolder.getContext()
                .setAuthentication(new JwtAuthenticationToken(
                        jwt,
                        List.of(new SimpleGrantedAuthority("ROLE_USER"), new SimpleGrantedAuthority("ROLE_ADMIN")),
                        jwt.getSubject()));

        Map<String, Object> session = new SessionService().getAllSessionObjects();

        assertEquals(jwt.getSubject(), session.get("username"));
        assertEquals("ana", session.get("principal"));
        assertEquals("keycloak-session-123", session.get("authid"));
        assertEquals(List.of("ROLE_USER", "ROLE_ADMIN"), session.get("roles"));
        assertFalse("JWT-derived session must not contain a password", session.containsKey("password"));
    }
}
