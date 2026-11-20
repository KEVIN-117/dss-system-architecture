package uatf.dss.authservice.adapter.out.keycloak;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriBuilder;
import uatf.dss.authservice.domain.exception.DomainException;
import uatf.dss.authservice.domain.exception.conflict.IdentityResourceConflictException;
import uatf.dss.authservice.domain.exception.notfound.IdentityResourceNotFoundException;
import uatf.dss.authservice.domain.exception.upstream.IdentityProviderException;
import uatf.dss.authservice.domain.exception.upstream.IdentityProviderUnavailableException;
import uatf.dss.authservice.domain.exception.validation.IdentityRequestRejectedException;

import java.net.URI;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/**
 * Calls {@code /admin/realms/{realm}/...} with the service-account token and turns every failure into a domain
 * exception:
 * <ul>
 *     <li>401: the token is renewed once and the call repeated.</li>
 *     <li>I/O errors and 502/503/504: idempotent calls (GET, PUT, DELETE) are retried {@code maxRetries} times with
 *     exponential backoff; POST is never retried because its outcome is unknown.</li>
 *     <li>400 → {@link IdentityRequestRejectedException}, 404 → {@link IdentityResourceNotFoundException},
 *     409 → {@link IdentityResourceConflictException}, timeouts and connection errors →
 *     {@link IdentityProviderUnavailableException} (503), anything else (403, 5xx) → {@link IdentityProviderException} (502).</li>
 * </ul>
 * Request bodies are JSON in UTF-8. Tokens, secrets and response bodies are never logged.
 */
public class KeycloakAdminHttpClient {

    private static final Logger log = LoggerFactory.getLogger(KeycloakAdminHttpClient.class);
    private static final Set<HttpMethod> IDEMPOTENT = Set.of(HttpMethod.GET, HttpMethod.PUT, HttpMethod.DELETE);
    private static final Set<Integer> RETRYABLE_STATUS = Set.of(502, 503, 504);

    private final RestClient restClient;
    private final KeycloakAdminTokenProvider tokenProvider;
    private final KeycloakAdminProperties properties;
    private final Sleeper sleeper;

    public KeycloakAdminHttpClient(RestClient restClient, KeycloakAdminTokenProvider tokenProvider,
                                   KeycloakAdminProperties properties) {
        this(restClient, tokenProvider, properties, Sleeper.THREAD);
    }

    KeycloakAdminHttpClient(RestClient restClient, KeycloakAdminTokenProvider tokenProvider,
                            KeycloakAdminProperties properties, Sleeper sleeper) {
        this.restClient = restClient;
        this.tokenProvider = tokenProvider;
        this.properties = properties;
        this.sleeper = sleeper;
    }

    /** A call to the admin API. {@code path} is relative to {@code /admin/realms/{realm}} and may use {@code {var}}. */
    record Call(HttpMethod method, String path, Object[] uriVariables, Map<String, Object> query, Object body,
                String description) {

        static Call of(HttpMethod method, String description, String path, Object... uriVariables) {
            return new Call(method, path, uriVariables, new LinkedHashMap<>(), null, description);
        }

        Call query(String name, Object value) {
            if (value != null) {
                query.put(name, value);
            }
            return this;
        }

        Call body(Object value) {
            return new Call(method, path, uriVariables, query, value, description);
        }
    }

    <T> T fetch(Call call, Class<T> type) {
        return execute(call, spec -> spec.body(type));
    }

    <T> T fetch(Call call, ParameterizedTypeReference<T> type) {
        return execute(call, spec -> spec.body(type));
    }

    void send(Call call) {
        execute(call, RestClient.ResponseSpec::toBodilessEntity);
    }

    /** Sends a POST that creates a resource and returns the id taken from the {@code Location} header. */
    String create(Call call) {
        ResponseEntity<Void> response = execute(call, RestClient.ResponseSpec::toBodilessEntity);
        URI location = response.getHeaders().getLocation();
        if (location == null) {
            throw new IdentityProviderException("Keycloak no devolvió la ubicación del recurso creado (" + call.description() + ").");
        }
        String path = location.getPath();
        return path.substring(path.lastIndexOf('/') + 1);
    }

    private <R> R execute(Call call, Function<RestClient.ResponseSpec, R> extractor) {
        boolean retryable = IDEMPOTENT.contains(call.method());
        boolean tokenRenewed = false;
        int attempt = 0;
        while (true) {
            try {
                return extractor.apply(request(call));
            } catch (RestClientResponseException e) {
                int status = e.getStatusCode().value();
                if (status == 401 && !tokenRenewed) {
                    tokenProvider.invalidate();
                    tokenRenewed = true;
                    continue;
                }
                if (retryable && RETRYABLE_STATUS.contains(status) && attempt < properties.maxRetries()) {
                    backoff(++attempt, call, "HTTP " + status);
                    continue;
                }
                throw translate(call, e);
            } catch (ResourceAccessException e) {
                if (retryable && attempt < properties.maxRetries()) {
                    backoff(++attempt, call, e.getClass().getSimpleName());
                    continue;
                }
                log.warn("Keycloak no respondió en '{}': {}", call.description(), rootCauseName(e));
                throw new IdentityProviderUnavailableException(
                        "Keycloak no está disponible (" + call.description() + ").");
            }
        }
    }

    private RestClient.ResponseSpec request(Call call) {
        String token = tokenProvider.accessToken();
        RestClient.RequestBodySpec spec = restClient.method(call.method())
                .uri(builder -> uri(builder, call))
                .headers(headers -> headers.setBearerAuth(token))
                .accept(MediaType.APPLICATION_JSON);
        if (call.body() != null) {
            spec.contentType(MediaType.APPLICATION_JSON).body(call.body());
        }
        return spec.retrieve();
    }

    private URI uri(UriBuilder builder, Call call) {
        builder.path("/admin/realms/{realm}").path(call.path());
        call.query().forEach(builder::queryParam);
        Object[] variables = new Object[call.uriVariables().length + 1];
        variables[0] = properties.realm();
        System.arraycopy(call.uriVariables(), 0, variables, 1, call.uriVariables().length);
        return builder.build(variables);
    }

    private void backoff(int attempt, Call call, String reason) {
        Duration wait = properties.retryBackoff().multipliedBy(1L << (attempt - 1));
        log.info("Reintentando '{}' ({}/{}) tras {}", call.description(), attempt, properties.maxRetries(), reason);
        sleeper.sleep(wait);
    }

    private DomainException translate(Call call, RestClientResponseException e) {
        int status = e.getStatusCode().value();
        String detail = keycloakMessage(e);
        return switch (status) {
            case 400 -> new IdentityRequestRejectedException(
                    "Keycloak rechazó la solicitud (" + call.description() + ")" + suffix(detail));
            case 404 -> new IdentityResourceNotFoundException(
                    "No existe en Keycloak (" + call.description() + ")" + suffix(detail));
            case 409 -> new IdentityResourceConflictException(
                    "Conflicto en Keycloak (" + call.description() + ")" + suffix(detail));
            case 401, 403 -> {
                log.warn("La cuenta de servicio {} no tiene privilegios para '{}' (HTTP {})",
                        properties.clientId(), call.description(), status);
                yield new IdentityProviderException(
                        "La cuenta de servicio de auth-service no tiene privilegios en Keycloak para: " + call.description());
            }
            default -> {
                log.warn("Keycloak respondió HTTP {} en '{}'", status, call.description());
                yield new IdentityProviderException(
                        "Keycloak respondió con un error (HTTP " + status + ") en: " + call.description());
            }
        };
    }

    /** Keycloak puts its reason in {@code errorMessage} or {@code error_description}. */
    private static String keycloakMessage(RestClientResponseException e) {
        try {
            Map<?, ?> body = e.getResponseBodyAs(Map.class);
            if (body == null) {
                return null;
            }
            Object message = body.get("errorMessage");
            if (message == null) {
                message = body.get("error_description");
            }
            return message == null ? null : message.toString();
        } catch (RuntimeException parseFailure) {
            return null;
        }
    }

    private static String suffix(String detail) {
        return detail == null || detail.isBlank() ? "." : ": " + detail;
    }

    private static String rootCauseName(Throwable e) {
        Throwable root = e;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        return root.getClass().getSimpleName();
    }

    @FunctionalInterface
    interface Sleeper {
        Sleeper THREAD = duration -> {
            try {
                Thread.sleep(duration);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new IdentityProviderUnavailableException("Operación con Keycloak interrumpida.");
            }
        };

        void sleep(Duration duration);
    }
}
