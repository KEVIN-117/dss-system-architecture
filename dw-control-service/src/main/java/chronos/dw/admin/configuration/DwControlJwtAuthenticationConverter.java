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
 * {@link #CLOSURE_MANAGE} and {@link #ETL_MONITOR_READ}. They are managed from the admin portal, so granting DW access
 * no longer needs the Keycloak console.
 *
 * <p>While users still hold the old {@code dw-control-service} client roles ({@code DW_CLOSURE_READ}, ...), they are
 * accepted <em>only</em> when {@code legacyRolesEnabled} is on, and translated to the same permission names. The URL
 * rules therefore only know the new names, and turning the flag off is the whole migration.
 *
 * <p>Any other role of either client is ignored.
 */
public class DwControlJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    public static final String CLOSURE_READ = "dw:closure:read";
    public static final String CLOSURE_MANAGE = "dw:closure:manage";
    public static final String ETL_MONITOR_READ = "dw:etl-monitor:read";

    static final Set<String> DW_PERMISSIONS = Set.of(CLOSURE_READ, CLOSURE_MANAGE, ETL_MONITOR_READ);
    static final Map<String, String> LEGACY_ROLES = Map.of(
            "DW_CLOSURE_READ", CLOSURE_READ,
            "DW_CLOSURE_MANAGE", CLOSURE_MANAGE,
            "DW_ETL_MONITOR_READ", ETL_MONITOR_READ);

    private final JwtGrantedAuthoritiesConverter scopeConverter = new JwtGrantedAuthoritiesConverter();
    private final String permissionsClientId;
    private final String legacyClientId;
    private final boolean legacyRolesEnabled;

    /**
     * @param permissionsClientId catalog client holding the permissions ({@code dss-permissions})
     * @param legacyClientId      client that held the old {@code DW_*} roles ({@code dw-control-service})
     * @param legacyRolesEnabled  whether the old roles are still accepted (coexistence)
     */
    public DwControlJwtAuthenticationConverter(
            String permissionsClientId, String legacyClientId, boolean legacyRolesEnabled) {
        if (!StringUtils.hasText(permissionsClientId)) {
            throw new IllegalArgumentException("Keycloak permissions client id is required");
        }
        if (legacyRolesEnabled && !StringUtils.hasText(legacyClientId)) {
            throw new IllegalArgumentException("Keycloak client id of the legacy DW roles is required");
        }
        this.permissionsClientId = permissionsClientId.trim();
        this.legacyClientId = legacyClientId == null ? null : legacyClientId.trim();
        this.legacyRolesEnabled = legacyRolesEnabled;
    }

    public boolean legacyRolesEnabled() {
        return legacyRolesEnabled;
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
        Object resourceAccess = jwt.getClaim("resource_access");
        for (String role : clientRoles(resourceAccess, permissionsClientId)) {
            if (DW_PERMISSIONS.contains(role)) {
                authorities.add(new SimpleGrantedAuthority(role));
            }
        }
        if (legacyRolesEnabled) {
            for (String role : clientRoles(resourceAccess, legacyClientId)) {
                String permission = LEGACY_ROLES.get(role);
                if (permission != null) {
                    authorities.add(new SimpleGrantedAuthority(permission));
                }
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
