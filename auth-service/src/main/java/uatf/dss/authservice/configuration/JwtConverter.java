package uatf.dss.authservice.configuration;

import lombok.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Turns a Keycloak access token into Spring Security authorities (IAM-004, decision D1):
 * <ul>
 *     <li>{@code resource_access.<permissions-client-id>.roles} (default {@code dss-permissions}): functional
 *     permissions, kept as-is without prefix, e.g. {@code iam:users:write}. Checked with {@code hasAuthority}.</li>
 *     <li>{@code realm_access.roles}: realm roles as {@code ROLE_<name>}, e.g. {@code ROLE_SUPERADMIN}.</li>
 *     <li>{@code resource_access.<resource-id>.roles} (default {@code uatf-auth-service}): legacy client roles as
 *     {@code ROLE_<name>}, kept while services migrate to {@code dss-permissions} (removed in IAM-019).</li>
 *     <li>{@code scope}: {@code SCOPE_<scope>}.</li>
 * </ul>
 */
@Component
public class JwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private static final String ROLE_PREFIX = "ROLE_";

    private final JwtGrantedAuthoritiesConverter scopesConverter = new JwtGrantedAuthoritiesConverter();
    private final String principalAttribute;
    private final String legacyRoleClientId;
    private final String permissionsClientId;

    public JwtConverter(
            @Value("${jwt.auth.converter.principal-attribute:preferred_username}") String principalAttribute,
            @Value("${jwt.auth.converter.resource-id:uatf-auth-service}") String legacyRoleClientId,
            @Value("${jwt.auth.converter.permissions-client-id:dss-permissions}") String permissionsClientId) {
        this.principalAttribute = principalAttribute;
        this.legacyRoleClientId = legacyRoleClientId;
        this.permissionsClientId = permissionsClientId;
    }

    @Override
    public AbstractAuthenticationToken convert(@NonNull Jwt jwt) {
        Set<GrantedAuthority> authorities = new LinkedHashSet<>(scopesConverter.convert(jwt));
        clientRoles(jwt, permissionsClientId).map(SimpleGrantedAuthority::new).forEach(authorities::add);
        realmRoles(jwt).map(role -> new SimpleGrantedAuthority(ROLE_PREFIX + role)).forEach(authorities::add);
        clientRoles(jwt, legacyRoleClientId).map(role -> new SimpleGrantedAuthority(ROLE_PREFIX + role))
                .forEach(authorities::add);
        return new JwtAuthenticationToken(jwt, authorities, principalName(jwt));
    }

    private String principalName(Jwt jwt) {
        if (principalAttribute != null && jwt.hasClaim(principalAttribute)) {
            return jwt.getClaimAsString(principalAttribute);
        }
        return jwt.hasClaim("preferred_username") ? jwt.getClaimAsString("preferred_username") : jwt.getSubject();
    }

    private static Stream<String> realmRoles(Jwt jwt) {
        return roles(jwt.getClaim("realm_access"));
    }

    private static Stream<String> clientRoles(Jwt jwt, String clientId) {
        if (clientId == null || clientId.isBlank()
                || !(jwt.getClaim("resource_access") instanceof Map<?, ?> resourceAccess)) {
            return Stream.empty();
        }
        return roles(resourceAccess.get(clientId));
    }

    private static Stream<String> roles(Object container) {
        if (!(container instanceof Map<?, ?> map) || !(map.get("roles") instanceof Collection<?> roles)) {
            return Stream.empty();
        }
        return roles.stream()
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .filter(role -> !role.isBlank());
    }
}
