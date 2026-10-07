/*
 * Copyright 2026 Spicule Ltd
 * Apache License, Version 2.0.
 */
package org.saiku.web.security.keycloak;

import java.util.List;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/** Builds the Keycloak JWT decoder and applies issuer and OLAP audience validation. */
public final class KeycloakJwtDecoderFactory {

    private KeycloakJwtDecoderFactory() {}

    /**
     * Creates a decoder using Keycloak's JWK Set endpoint.
     *
     * <p>An unconfigured local Saiku instance can still start with its legacy authentication. It
     * rejects Bearer tokens until the issuer and JWK Set URI are configured. A partial configuration
     * fails immediately so a typo cannot silently weaken validation.
     */
    public static JwtDecoder create(String jwkSetUri, String issuerUri, String audience) {
        boolean hasJwkSetUri = hasText(jwkSetUri);
        boolean hasIssuerUri = hasText(issuerUri);
        if (!hasJwkSetUri && !hasIssuerUri) {
            return token -> {
                throw new BadJwtException("Keycloak JWT authentication is not configured: set "
                        + "KEYCLOAK_JWK_SET_URI and KEYCLOAK_ISSUER_URI");
            };
        }
        if (!hasJwkSetUri || !hasIssuerUri || !hasText(audience)) {
            throw new IllegalStateException(
                    "Keycloak JWT configuration requires JWK Set URI, issuer URI, and OLAP audience");
        }

        NimbusJwtDecoder decoder =
                NimbusJwtDecoder.withJwkSetUri(jwkSetUri.trim()).build();
        OAuth2TokenValidator<Jwt> issuerValidator = JwtValidators.createDefaultWithIssuer(issuerUri.trim());
        OAuth2TokenValidator<Jwt> audienceValidator = jwt -> {
            List<String> audiences = jwt.getAudience();
            if (audiences != null && audiences.contains(audience.trim())) {
                return OAuth2TokenValidatorResult.success();
            }
            OAuth2Error error =
                    new OAuth2Error("invalid_token", "The access token is not intended for this OLAP service", null);
            return OAuth2TokenValidatorResult.failure(error);
        };
        decoder.setJwtValidator(jwt -> {
            OAuth2TokenValidatorResult issuerResult = issuerValidator.validate(jwt);
            if (issuerResult.hasErrors()) {
                return issuerResult;
            }
            return audienceValidator.validate(jwt);
        });
        return decoder;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
