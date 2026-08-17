package uatf.dss.authservice.configuration.audit;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.stream.Collectors;

import static net.logstash.logback.argument.StructuredArguments.kv;

@Component
public class AuditLoggingListener {

    private static final Logger AUDIT_LOGGER = LoggerFactory.getLogger("AUDIT_LOGGER");

    @EventListener
    public void onAuthenticationSuccess(AuthenticationSuccessEvent event) {
        HttpServletRequest request = getCurrentHttpRequest();
        if (request != null && isAuditEndpoint(request.getRequestURI())) {
            Authentication auth = event.getAuthentication();
            String keycloakId = extractKeycloakId(auth);
            String roles = extractRoles(auth);
            String ipAddress = getClientIp(request);

            AUDIT_LOGGER.info("Login exitoso",
                    kv("event_type", "LOGIN_SUCCESS"),
                    kv("keycloak_id", keycloakId),
                    kv("ip_address", ipAddress),
                    kv("roles", roles));
        }
    }

    @EventListener
    public void onAuthenticationFailure(AbstractAuthenticationFailureEvent event) {
        HttpServletRequest request = getCurrentHttpRequest();
        if (request != null && isAuditEndpoint(request.getRequestURI())) {
            Authentication auth = event.getAuthentication();
            String keycloakId = extractKeycloakId(auth);
            String ipAddress = getClientIp(request);

            AUDIT_LOGGER.info("Fallo de autenticación",
                    kv("event_type", "LOGIN_FAILURE"),
                    kv("keycloak_id", keycloakId),
                    kv("ip_address", ipAddress),
                    kv("exception", event.getException().getMessage()));
        }
    }

    private boolean isAuditEndpoint(String uri) {
        return uri != null && uri.contains("/auth/me");
    }

    private HttpServletRequest getCurrentHttpRequest() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes != null ? attributes.getRequest() : null;
    }

    private String extractKeycloakId(Authentication auth) {
        if (auth == null) return "UNKNOWN";
        if (auth.getPrincipal() instanceof Jwt jwt) {
            return jwt.getSubject();
        }
        return auth.getName();
    }

    private String extractRoles(Authentication auth) {
        if (auth == null || auth.getAuthorities() == null) return "";
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.joining(","));
    }

    private String getClientIp(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null || xfHeader.isEmpty()) {
            return request.getRemoteAddr();
        }
        return xfHeader.split(",")[0];
    }
}
