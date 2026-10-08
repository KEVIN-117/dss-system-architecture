/*
 * Copyright 2026 Spicule Ltd
 * Apache License, Version 2.0.
 */
package org.saiku.web.security.keycloak;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.util.StringUtils;

/** Maps trusted Keycloak claims into Saiku's Spring authorities and stable subject identity. */
public final class SaikuKeycloakJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final JwtGrantedAuthoritiesConverter scopeConverter = new JwtGrantedAuthoritiesConverter();
    private String clientId = "olap-service";

    public void setClientId(String clientId) {
        if (StringUtils.hasText(clientId)) {
            this.clientId = clientId.trim();
        }
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        if (!StringUtils.hasText(jwt.getSubject())) {
            throw new BadJwtException("Keycloak access token is missing the subject claim");
        }

        Set<GrantedAuthority> authorities = new LinkedHashSet<>();
        Collection<GrantedAuthority> scopes = scopeConverter.convert(jwt);
        if (scopes != null) {
            authorities.addAll(scopes);
        }
        authorities.addAll(extractRoles(jwt.getClaim("realm_access")));

        Object resourceAccessClaim = jwt.getClaim("resource_access");
        if (resourceAccessClaim instanceof Map<?, ?> resourceAccess) {
            Object olapClientAccess = resourceAccess.get(clientId);
            authorities.addAll(extractRoles(olapClientAccess));
            addSaikuRoleAliases(olapClientAccess, authorities);
        }

        // Saiku uses Authentication#getName() as the account/ACL identity. The immutable Keycloak
        // subject avoids username changes or case variants creating a different repository owner.
        return new org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken(
                jwt, authorities, jwt.getSubject());
    }

    private Set<GrantedAuthority> extractRoles(Object accessClaim) {
        if (!(accessClaim instanceof Map<?, ?> access)) {
            return Set.of();
        }
        Object rolesClaim = access.get("roles");
        if (!(rolesClaim instanceof Collection<?> roles)) {
            return Set.of();
        }

        Set<GrantedAuthority> authorities = new LinkedHashSet<>();
        for (Object role : roles) {
            if (!(role instanceof String roleName) || !StringUtils.hasText(roleName)) {
                continue;
            }
            String normalized = roleName.trim();
            if (!normalized.startsWith("ROLE_")) {
                normalized = "ROLE_" + normalized.toUpperCase(Locale.ROOT);
            }
            authorities.add(new SimpleGrantedAuthority(normalized));
        }
        return authorities;
    }

    /**
     * Maps OLAP-scoped Keycloak roles to the legacy Saiku authorities used by its existing gates.
     * This mapping is deliberately limited to this configured client's roles: realm-wide roles or
     * roles belonging to another client must not grant OLAP administrator access implicitly.
     */
    private void addSaikuRoleAliases(Object clientAccessClaim, Set<GrantedAuthority> authorities) {
        if (!(clientAccessClaim instanceof Map<?, ?> clientAccess)) {
            return;
        }
        Object rolesClaim = clientAccess.get("roles");
        if (!(rolesClaim instanceof Collection<?> roles)) {
            return;
        }

        for (Object role : roles) {
            if (!(role instanceof String roleName) || !StringUtils.hasText(roleName)) {
                continue;
            }
            switch (roleName.trim().toUpperCase(Locale.ROOT)) {
                case "OLAP_ADMIN" -> authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
                case "OLAP_USER" -> authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
                default -> {
                    // Other client roles retain their ROLE_<NAME> authority without aliases.
                }
            }
        }
    }
}
