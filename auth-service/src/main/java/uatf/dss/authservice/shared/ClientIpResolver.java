package uatf.dss.authservice.shared;

import jakarta.servlet.http.HttpServletRequest;
import org.jspecify.annotations.NonNull;

/**
 * Resolves the client IP of an HTTP request for audit purposes. Moved from {@code AuditLoggingListener} (IAM-005)
 * so that the login audit log and the administrative audit log apply exactly the same trust rules.
 */
public final class ClientIpResolver {

    private ClientIpResolver() {
    }

    public static String resolve(HttpServletRequest request) {
        return getClientIp(request);
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
    private static String getClientIp(HttpServletRequest request) {
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
    private static boolean isLikelyProxyAddress(String ip) {
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

    private static String trimToNull(String value) {
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
    private static String extractIpFromForwardedHeader(String forwardedHeader) {
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
