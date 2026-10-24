package chronos.dw.admin.configuration;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.util.StringUtils;

/** Maps only roles belonging to the dw-control-service Keycloak client into API permissions. */
public class DwControlJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private static final Set<String> DW_CONTROL_PERMISSIONS =
            Set.of("DW_CLOSURE_READ", "DW_CLOSURE_MANAGE", "DW_ETL_MONITOR_READ");

    private final JwtGrantedAuthoritiesConverter scopeConverter = new JwtGrantedAuthoritiesConverter();
    private final String clientId;

    public DwControlJwtAuthenticationConverter(String clientId) {
        if (!StringUtils.hasText(clientId)) {
            throw new IllegalArgumentException("Keycloak client id is required");
        }
        this.clientId = clientId.trim();
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        if (!StringUtils.hasText(jwt.getSubject()) || jwt.getSubject().length() > 255) {
            throw new BadJwtException("Access token has an invalid subject claim");
        }

        Set<GrantedAuthority> authorities = new LinkedHashSet<>();
        Collection<GrantedAuthority> scopes = scopeConverter.convert(jwt);
        if (scopes != null) {
            authorities.addAll(scopes);
        }
        authorities.addAll(extractServicePermissions(jwt.getClaim("resource_access")));

        return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
    }

    private Set<GrantedAuthority> extractServicePermissions(Object resourceAccessClaim) {
        if (!(resourceAccessClaim instanceof Map<?, ?> resourceAccess)) {
            return Set.of();
        }
        Object clientAccessClaim = resourceAccess.get(clientId);
        if (!(clientAccessClaim instanceof Map<?, ?> clientAccess)) {
            return Set.of();
        }
        Object rolesClaim = clientAccess.get("roles");
        if (!(rolesClaim instanceof Collection<?> roles)) {
            return Set.of();
        }

        Set<GrantedAuthority> permissions = new LinkedHashSet<>();
        for (Object role : roles) {
            if (role instanceof String permission && DW_CONTROL_PERMISSIONS.contains(permission)) {
                permissions.add(new SimpleGrantedAuthority(permission));
            }
        }
        return permissions;
    }
}
