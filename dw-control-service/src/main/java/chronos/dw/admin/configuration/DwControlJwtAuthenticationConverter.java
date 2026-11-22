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

/**
 * Maps DW permissions from the token into authorities (IAM-011).
 *
 * <p>Permissions come from the catalog client ({@code resource_access.dss-permissions.roles}): {@link #CLOSURE_READ},
 * {@link #CLOSURE_MANAGE}, {@link #ETL_MONITOR_READ}, {@link #ETL_EXECUTE} and {@link #ETL_SCHEDULE_MANAGE}. They are managed from the admin portal, so granting DW access
 * does not need the Keycloak console.
 *
 * <p>Any other role is ignored, including the old {@code DW_*} roles of the {@code dw-control-service} client, which
 * were retired in IAM-019.
 */
public class DwControlJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    public static final String CLOSURE_READ = "dw:closure:read";
    public static final String CLOSURE_MANAGE = "dw:closure:manage";
    public static final String ETL_MONITOR_READ = "dw:etl-monitor:read";
    /** LM-005: launch and stop Load Manager executions. */
    public static final String ETL_EXECUTE = "dw:etl:execute";
    /** LM-005: create, edit, pause and delete Load Manager schedules. */
    public static final String ETL_SCHEDULE_MANAGE = "dw:etl-schedule:manage";

    static final Set<String> DW_PERMISSIONS =
            Set.of(CLOSURE_READ, CLOSURE_MANAGE, ETL_MONITOR_READ, ETL_EXECUTE, ETL_SCHEDULE_MANAGE);

    private final JwtGrantedAuthoritiesConverter scopeConverter = new JwtGrantedAuthoritiesConverter();
    private final String permissionsClientId;

    /**
     * @param permissionsClientId catalog client holding the permissions ({@code dss-permissions})
     */
    public DwControlJwtAuthenticationConverter(String permissionsClientId) {
        if (!StringUtils.hasText(permissionsClientId)) {
            throw new IllegalArgumentException("Keycloak permissions client id is required");
        }
        this.permissionsClientId = permissionsClientId.trim();
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
        for (String role : clientRoles(jwt.getClaim("resource_access"), permissionsClientId)) {
            if (DW_PERMISSIONS.contains(role)) {
                authorities.add(new SimpleGrantedAuthority(role));
            }
        }

        return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
    }

    private static Set<String> clientRoles(Object resourceAccessClaim, String clientId) {
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
        Set<String> names = new LinkedHashSet<>();
        for (Object role : roles) {
            if (role instanceof String name) {
                names.add(name);
            }
        }
        return names;
    }
}
