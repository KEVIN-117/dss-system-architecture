/*
 * Copyright 2026 Spicule Ltd
 * Apache License, Version 2.0.
 */
package org.saiku.web.security.keycloak;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

public class KeycloakJwtDecoderFactoryTest {

    private static final String ISSUER = "http://localhost/realms/uatf";
    private static final String AUDIENCE = "olap-service";
    private static com.nimbusds.jose.jwk.RSAKey signingKey;
    private static HttpServer jwksServer;
    private static String jwksUri;

    @BeforeClass
    public static void startJwksEndpoint() throws Exception {
        signingKey = new RSAKeyGenerator(2048).keyID("test-key").generate();
        String jwks = new JWKSet(signingKey.toPublicJWK()).toString();
        jwksServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        jwksServer.createContext("/jwks", exchange -> writeJwks(exchange, jwks));
        jwksServer.start();
        jwksUri = "http://127.0.0.1:" + jwksServer.getAddress().getPort() + "/jwks";
    }

    @AfterClass
    public static void stopJwksEndpoint() {
        if (jwksServer != null) {
            jwksServer.stop(0);
        }
    }

    @Test
    public void accepts_valid_signature_issuer_and_audience() throws Exception {
        JwtDecoder decoder = KeycloakJwtDecoderFactory.create(jwksUri, ISSUER, AUDIENCE);

        Jwt jwt = decoder.decode(token(ISSUER, AUDIENCE, Instant.now().plusSeconds(300)));

        assertEquals("subject-123", jwt.getSubject());
        assertEquals(ISSUER, jwt.getIssuer().toString());
        assertEquals(AUDIENCE, jwt.getAudience().get(0));
    }

    @Test
    public void rejects_wrong_issuer() throws Exception {
        assertRejected(
                token("http://localhost/realms/other", AUDIENCE, Instant.now().plusSeconds(300)));
    }

    @Test
    public void rejects_wrong_audience() throws Exception {
        assertRejected(token(ISSUER, "another-api", Instant.now().plusSeconds(300)));
    }

    @Test
    public void rejects_expired_token() throws Exception {
        assertRejected(token(ISSUER, AUDIENCE, Instant.now().minusSeconds(30)));
    }

    private static void assertRejected(String token) {
        try {
            KeycloakJwtDecoderFactory.create(jwksUri, ISSUER, AUDIENCE).decode(token);
            fail("expected invalid Keycloak token to be rejected");
        } catch (JwtException expected) {
            // Signature-valid tokens still must pass issuer, audience and timestamp validation.
        }
    }

    private static String token(String issuer, String audience, Instant expiresAt) throws JOSEException {
        Instant now = Instant.now();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer(issuer)
                .subject("subject-123")
                .audience(audience)
                .issueTime(Date.from(now.minusSeconds(5)))
                .notBeforeTime(Date.from(now.minusSeconds(5)))
                .expirationTime(Date.from(expiresAt))
                .build();
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256)
                        .keyID(signingKey.getKeyID())
                        .build(),
                claims);
        jwt.sign(new RSASSASigner(signingKey));
        return jwt.serialize();
    }

    private static void writeJwks(com.sun.net.httpserver.HttpExchange exchange, String jwks) throws IOException {
        byte[] response = jwks.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, response.length);
        try (var body = exchange.getResponseBody()) {
            body.write(response);
        }
    }
}
