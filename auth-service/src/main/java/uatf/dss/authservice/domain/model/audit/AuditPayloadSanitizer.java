package uatf.dss.authservice.domain.model.audit;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Removes secrets from the before/after snapshots of an audit entry. Any key whose name contains one of the
 * sensitive fragments (case-insensitive) is replaced by {@value #REDACTED}, at any nesting depth. Callers should not
 * put secrets in snapshots in the first place; this is the safety net that makes the guarantee unconditional.
 */
public final class AuditPayloadSanitizer {

    public static final String REDACTED = "[REDACTED]";
    private static final Set<String> SENSITIVE_FRAGMENTS = Set.of(
            "password", "passwd", "secret", "token", "credential", "apikey", "api_key", "privatekey", "private_key");
    private static final int MAX_DEPTH = 10;

    private AuditPayloadSanitizer() {
    }

    public static Map<String, Object> sanitize(Map<String, ?> payload) {
        if (payload == null) {
            return null;
        }
        return Collections.unmodifiableMap(sanitizeMap(payload, 0));
    }

    static boolean isSensitive(String key) {
        if (key == null) {
            return false;
        }
        String normalized = key.toLowerCase(Locale.ROOT);
        return SENSITIVE_FRAGMENTS.stream().anyMatch(normalized::contains);
    }

    private static Map<String, Object> sanitizeMap(Map<?, ?> map, int depth) {
        Map<String, Object> clean = new LinkedHashMap<>();
        map.forEach((key, value) -> {
            String name = String.valueOf(key);
            clean.put(name, isSensitive(name) ? REDACTED : sanitizeValue(value, depth + 1));
        });
        return clean;
    }

    private static Object sanitizeValue(Object value, int depth) {
        if (depth > MAX_DEPTH) {
            return REDACTED;
        }
        if (value instanceof Map<?, ?> map) {
            return sanitizeMap(map, depth);
        }
        if (value instanceof Collection<?> collection) {
            List<Object> clean = new ArrayList<>(collection.size());
            collection.forEach(item -> clean.add(sanitizeValue(item, depth + 1)));
            return clean;
        }
        if (value == null || value instanceof String || value instanceof Number || value instanceof Boolean) {
            return value;
        }
        return value.toString();
    }
}
