package uatf.dss.authservice.domain.validator;

import uatf.dss.authservice.domain.exception.validation.ValidationException;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Collection;
import java.util.Locale;
import java.util.Set;

/**
 * Rules for the URIs of an OAuth client (IAM-008):
 * <ul>
 *     <li>Redirect and post-logout URIs are absolute {@code http(s)} URLs with a concrete host. A wildcard is only
 *     allowed as a trailing {@code /*} of the path (the only form Keycloak supports); {@code *}, wildcard hosts,
 *     user info and fragments are rejected.</li>
 *     <li>Web origins are {@code scheme://host[:port]} without path, or {@code +} ("same as the redirect URIs").
 *     {@code *} is rejected.</li>
 *     <li>With {@code requireHttps}, plain {@code http} is only accepted for loopback hosts (local development).</li>
 * </ul>
 */
public final class ClientUriPolicy {

    private static final Set<String> LOOPBACK = Set.of("localhost", "127.0.0.1", "[::1]", "::1");
    private static final String TRAILING_WILDCARD = "/*";

    private ClientUriPolicy() {
    }

    public static void validateRedirectUris(Collection<String> uris, boolean requireHttps, String field) {
        if (uris != null) {
            uris.forEach(uri -> validateRedirectUri(uri, requireHttps, field));
        }
    }

    public static void validateWebOrigins(Collection<String> origins, boolean requireHttps) {
        if (origins != null) {
            origins.forEach(origin -> validateWebOrigin(origin, requireHttps));
        }
    }

    static void validateRedirectUri(String value, boolean requireHttps, String field) {
        String uri = value == null ? "" : value.trim();
        if (uri.isEmpty()) {
            throw invalid(field, value, "no puede estar vacía");
        }
        String withoutWildcard = uri.endsWith(TRAILING_WILDCARD) ? uri.substring(0, uri.length() - 1) : uri;
        if (withoutWildcard.contains("*")) {
            throw invalid(field, value, "solo se permite el comodín al final de la ruta (/*)");
        }
        URI parsed = parse(withoutWildcard, field, value);
        checkHttpScheme(parsed, requireHttps, field, value);
        if (parsed.getRawUserInfo() != null) {
            throw invalid(field, value, "no puede incluir usuario ni contraseña");
        }
        if (parsed.getRawFragment() != null) {
            throw invalid(field, value, "no puede incluir un fragmento (#)");
        }
    }

    static void validateWebOrigin(String value, boolean requireHttps) {
        String origin = value == null ? "" : value.trim();
        if ("+".equals(origin)) {
            return;
        }
        if (origin.isEmpty() || origin.contains("*")) {
            throw invalid("webOrigins", value, "debe ser un origen concreto (esquema://host[:puerto]) o +");
        }
        URI parsed = parse(origin, "webOrigins", value);
        checkHttpScheme(parsed, requireHttps, "webOrigins", value);
        boolean hasPath = parsed.getRawPath() != null && !parsed.getRawPath().isEmpty();
        if (hasPath || parsed.getRawQuery() != null || parsed.getRawFragment() != null || parsed.getRawUserInfo() != null) {
            throw invalid("webOrigins", value, "debe ser solo esquema://host[:puerto], sin ruta");
        }
    }

    private static URI parse(String uri, String field, String original) {
        try {
            URI parsed = new URI(uri);
            if (!parsed.isAbsolute() || parsed.getHost() == null || parsed.getHost().isBlank()) {
                throw invalid(field, original, "debe ser una URL absoluta con host");
            }
            return parsed;
        } catch (URISyntaxException e) {
            throw invalid(field, original, "no es una URL válida");
        }
    }

    private static void checkHttpScheme(URI uri, boolean requireHttps, String field, String original) {
        String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("https") && !scheme.equals("http")) {
            throw invalid(field, original, "debe usar http o https");
        }
        if (requireHttps && scheme.equals("http") && !LOOPBACK.contains(uri.getHost().toLowerCase(Locale.ROOT))) {
            throw invalid(field, original, "debe usar https en este entorno");
        }
    }

    private static ValidationException invalid(String field, String value, String reason) {
        return new ValidationException(field + ": '" + value + "' " + reason + ".");
    }
}
