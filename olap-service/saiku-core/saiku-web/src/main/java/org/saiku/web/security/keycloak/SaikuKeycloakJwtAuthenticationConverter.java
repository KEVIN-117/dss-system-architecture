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

/**
 * Maps trusted Keycloak claims into Saiku's Spring authorities and stable subject identity.
 *
 * <p>Saiku's gates use two authorities: {@code ROLE_ADMIN} (OLAP administration: {@code /rest/saiku/admin/**},
 * statistics, datasources) and {@code ROLE_USER}. Since IAM-012 they come from permissions of the catalog client
 * ({@code resource_access.dss-permissions.roles}): {@value #OLAP_ADMIN_PERMISSION} and {@value #OLAP_USER_PERMISSION},
 * assignable from the admin portal. Administration is a permission of its own, separate from business access (D4):
 * a {@code SUPERADMIN} without {@code olap:admin} is not a Saiku administrator.
 *
 * <p>While {@code legacyRolesEnabled} is on (coexistence), the roles of the OLAP client ({@code olap-service}) are
 * still read as before: {@code OLAP_ADMIN}/{@code OLAP_USER} become {@code ROLE_ADMIN}/{@code ROLE_USER} and every
 * role also keeps its {@code ROLE_<NAME>} authority. With it off, that client grants nothing.
 *
 * <p>Realm roles keep their {@code ROLE_<NAME>} authority (Mondrian role mapping uses them), except the reserved
 * {@code ROLE_ADMIN} and {@code ROLE_USER}: realm roles can be created from the admin API, so a realm role named
 * {@code ADMIN} must not make its holders Saiku administrators.
 */
public final class SaikuKeycloakJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    public static final String OLAP_ADMIN_PERMISSION = "olap:admin";
    public static final String OLAP_USER_PERMISSION = "olap:user";

    static final String ROLE_ADMIN = "ROLE_ADMIN";
    static final String ROLE_USER = "ROLE_USER";
    private static final Set<String> RESERVED = Set.of(ROLE_ADMIN, ROLE_USER);

    private final JwtGrantedAuthoritiesConverter scopeConverter = new JwtGrantedAuthoritiesConverter();
    private String clientId = "olap-service";
    private String permissionsClientId = "dss-permissions";
    private boolean legacyRolesEnabled = true;

    /** Client of the legacy {@code OLAP_ADMIN}/{@code OLAP_USER} roles. */
    public void setClientId(String clientId) {
        if (StringUtils.hasText(clientId)) {
            this.clientId = clientId.trim();
        }
    }

    /** Catalog client holding the permissions ({@code dss-permissions}). */
    public void setPermissionsClientId(String permissionsClientId) {
        if (StringUtils.hasText(permissionsClientId)) {
            this.permissionsClientId = permissionsClientId.trim();
        }
    }

    /** Coexistence: also accept the roles of the OLAP client. */
    public void setLegacyRolesEnabled(boolean legacyRolesEnabled) {
        this.legacyRolesEnabled = legacyRolesEnabled;
    }

    public boolean isLegacyRolesEnabled() {
        return legacyRolesEnabled;
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
        for (String role : roles(jwt.getClaim("realm_access"))) {
            String authority = authorityFor(role);
            if (!RESERVED.contains(authority)) {
                authorities.add(new SimpleGrantedAuthority(authority));
            }
        }

        Object resourceAccessClaim = jwt.getClaim("resource_access");
        if (resourceAccessClaim instanceof Map<?, ?> resourceAccess) {
            for (String permission : roles(resourceAccess.get(permissionsClientId))) {
                switch (permission) {
                    case OLAP_ADMIN_PERMISSION -> authorities.add(new SimpleGrantedAuthority(ROLE_ADMIN));
                    case OLAP_USER_PERMISSION -> authorities.add(new SimpleGrantedAuthority(ROLE_USER));
                    default -> {
                        // Other permissions belong to other services.
                    }
                }
            }
            if (legacyRolesEnabled) {
                addLegacyClientRoles(roles(resourceAccess.get(clientId)), authorities);
            }
        }

        // Saiku uses Authentication#getName() as the account/ACL identity. The immutable Keycloak
        // subject avoids username changes or case variants creating a different repository owner.
        return new org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken(
                jwt, authorities, jwt.getSubject());
    }

    /**
     * Legacy mapping of this configured client's roles, deliberately limited to it: realm-wide roles or roles of
     * another client must not grant OLAP administrator access implicitly.
     */
    private static void addLegacyClientRoles(Set<String> clientRoles, Set<GrantedAuthority> authorities) {
        for (String role : clientRoles) {
            authorities.add(new SimpleGrantedAuthority(authorityFor(role)));
            switch (role.toUpperCase(Locale.ROOT)) {
                case "OLAP_ADMIN" -> authorities.add(new SimpleGrantedAuthority(ROLE_ADMIN));
                case "OLAP_USER" -> authorities.add(new SimpleGrantedAuthority(ROLE_USER));
                default -> {
                    // Other client roles retain their ROLE_<NAME> authority without aliases.
                }
            }
        }
    }

    private static String authorityFor(String role) {
        return role.startsWith("ROLE_") ? role : "ROLE_" + role.toUpperCase(Locale.ROOT);
    }

    private static Set<String> roles(Object accessClaim) {
        if (!(accessClaim instanceof Map<?, ?> access)) {
            return Set.of();
        }
        Object rolesClaim = access.get("roles");
        if (!(rolesClaim instanceof Collection<?> roles)) {
            return Set.of();
        }
        Set<String> names = new LinkedHashSet<>();
        for (Object role : roles) {
            if (role instanceof String roleName && StringUtils.hasText(roleName)) {
                names.add(roleName.trim());
            }
        }
        return names;
    }
}
