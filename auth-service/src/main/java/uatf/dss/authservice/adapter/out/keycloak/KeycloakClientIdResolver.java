package uatf.dss.authservice.adapter.out.keycloak;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import uatf.dss.authservice.domain.exception.notfound.IdentityResourceNotFoundException;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

/**
 * Resolves a public {@code clientId} to Keycloak's internal client id, which the admin API needs in its paths.
 * Results are cached; if a call with a cached id answers 404 (client deleted and recreated) the id is resolved
 * again once.
 */
class KeycloakClientIdResolver {

    private static final ParameterizedTypeReference<List<KeycloakRepresentations.ClientRepresentation>> CLIENTS =
            new ParameterizedTypeReference<>() {
            };

    private final KeycloakAdminHttpClient http;
    private final Map<String, String> cache = new ConcurrentHashMap<>();

    KeycloakClientIdResolver(KeycloakAdminHttpClient http) {
        this.http = http;
    }

    String internalId(String clientId) {
        return cache.computeIfAbsent(clientId, this::lookup);
    }

    /** Runs {@code action} with the internal id, re-resolving once if the cached id is stale. */
    <T> T withInternalId(String clientId, Function<String, T> action) {
        String cached = internalId(clientId);
        try {
            return action.apply(cached);
        } catch (IdentityResourceNotFoundException notFound) {
            cache.remove(clientId, cached);
            String fresh = internalId(clientId);
            if (fresh.equals(cached)) {
                throw notFound;
            }
            return action.apply(fresh);
        }
    }

    void forget(String clientId) {
        cache.remove(clientId);
    }

    private String lookup(String clientId) {
        List<KeycloakRepresentations.ClientRepresentation> found = http.fetch(
                KeycloakAdminHttpClient.Call.of(HttpMethod.GET, "buscar cliente " + clientId, "/clients")
                        .query("clientId", clientId),
                CLIENTS);
        return found == null ? missing(clientId) : found.stream()
                .filter(client -> clientId.equals(client.clientId()))
                .map(KeycloakRepresentations.ClientRepresentation::id)
                .findFirst()
                .orElseGet(() -> missing(clientId));
    }

    private static String missing(String clientId) {
        throw new IdentityResourceNotFoundException("No existe en Keycloak el cliente " + clientId + ".");
    }
}
