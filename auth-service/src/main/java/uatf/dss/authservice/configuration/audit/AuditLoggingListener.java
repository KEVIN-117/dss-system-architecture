package uatf.dss.authservice.configuration.audit;

import jakarta.servlet.http.HttpServletRequest;
import org.jspecify.annotations.NonNull;
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

import java.net.URI;
import java.util.Set;
import java.util.stream.Collectors;

import static net.logstash.logback.argument.StructuredArguments.kv;

@Component
public class AuditLoggingListener {

    private static final Logger AUDIT_LOGGER = LoggerFactory.getLogger("AUDIT_LOGGER");
    private static final Set<String> AUDITED_ENDPOINTS = Set.of("/auth/me");

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
        if (uri == null) {
            return false;
        }
        try {
            String path = URI.create(uri).getPath();
            return AUDITED_ENDPOINTS.contains(path);
        } catch (IllegalArgumentException ex) {
            return AUDITED_ENDPOINTS.contains(uri);
        }
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
        if (auth == null || auth.getAuthorities() == null) {
            return "";
        }
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.joining(","));
    }

    /**
     * Extracts the client IP address in a way that is safer for audit logging.
     * Assumptions:
     * - When deployed behind a trusted reverse proxy (e.g. ingress/load-balancer),
     *   the proxy terminates the connection and sets/cleans IP-related headers.
     * - When the service is hit directly (no proxy), we do NOT trust client‑controlled
     *   headers and instead use {@link HttpServletRequest#getRemoteAddr()}.
     * Strategy:
     * - If the remote address looks like a proxy address (loopback/private RFC1918),
     *   we preferentially use proxy-populated headers (X-Real-IP, Forwarded, X-Forwarded-For).
     * - Otherwise, we fall back to remoteAddr to avoid trusting spoofable headers.
     */
    private String getClientIp(HttpServletRequest request) {
        if (request == null) {
            return "";
        }

        String remoteAddr = request.getRemoteAddr();
        // If this does not look like a proxy address, prefer the direct remote address
        if (!isLikelyProxyAddress(remoteAddr)) {
            return remoteAddr;
        }

        // Prefer X-Real-IP if present (commonly set by Nginx / some proxies)
        String realIp = trimToNull(request.getHeader("X-Real-IP"));
        if (realIp != null) {
            return realIp;
        }

        // RFC 7239 Forwarded header: e.g. "for=203.0.113.43;proto=https;host=example.com"
        String forwarded = trimToNull(request.getHeader("Forwarded"));
        if (forwarded != null) {
            String forwardedIp = extractIpFromForwardedHeader(forwarded);
            if (forwardedIp != null) {
                return forwardedIp;
            }
        }

        // X-Forwarded-For: first value is the original client IP if proxy is trusted
        String xff = trimToNull(request.getHeader("X-Forwarded-For"));
        if (xff != null) {
            String[] parts = xff.split(",");
            if (parts.length > 0) {
                String candidate = parts[0].trim();
                if (!candidate.isEmpty()) {
                    return candidate;
                }
            }
        }
        return remoteAddr;
    }

    /**
     * Heuristic: treat loopback and RFC1918 private addresses as "likely proxy" addresses.
     * This avoids trusting spoofable headers when the remote peer is a public client.
     */
    private boolean isLikelyProxyAddress(String ip) {
        if (ip == null) {
            return false;
        }
        // IPv4 private ranges and loopback
        if (ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
            return true;
        }
        // 172.16.0.0 - 172.31.255.255
        if (ip.startsWith("172.")) {
            String[] parts = ip.split("\\.");
            if (parts.length >= 2) {
                try {
                    int secondOctet = Integer.parseInt(parts[1]);
                    if (secondOctet >= 16 && secondOctet <= 31) {
                        return true;
                    }
                } catch (NumberFormatException ignored) {
                    // fall through to false
                }
            }
        }
        // IPv6 loopback
        return "::1".equals(ip);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * Parse a minimal "Forwarded" header to extract the first "for" parameter.
     * Example header: "for=203.0.113.43;proto=https;host=example.com"
     */
    private String extractIpFromForwardedHeader(String forwardedHeader) {
        if (forwardedHeader == null) {
            return null;
        }
        String[] params = forwardedHeader.split(";");
        for (String param : params) {
            String trimmed = param.trim();
            if (trimmed.toLowerCase().startsWith("for=")) {
                String value = getValue(trimmed);
                return value.isEmpty() ? null : value;
            }
        }
        return null;
    }

    private static @NonNull String getValue(String trimmed) {
        String value = trimmed.substring(4).trim();
        if (value.startsWith("\"") && value.endsWith("\"") && value.length() >= 2) {
            value = value.substring(1, value.length() - 1);
        }
        // Some proxies use "for=\"[ip]:port\"" or "for=[ip]:port"
        int portSeparator = value.indexOf(':');
        if (portSeparator > 0) {
            value = value.substring(0, portSeparator);
        }
        return value;
    }
}
