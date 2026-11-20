package uatf.dss.authservice.adapter.out.keycloak;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import uatf.dss.authservice.domain.exception.upstream.IdentityProviderException;
import uatf.dss.authservice.domain.exception.upstream.IdentityProviderUnavailableException;

import java.time.Clock;
import java.time.Instant;

/**
 * Obtains and caches the service-account access token ({@code client_credentials}). The token is reused until
 * {@code tokenExpirySkew} before it expires; {@link #invalidate()} forces a new one (for example after a 401).
 * Neither the secret nor the token is ever logged.
 */
public class KeycloakAdminTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(KeycloakAdminTokenProvider.class);
    private static final long DEFAULT_LIFETIME_SECONDS = 60;

    private final RestClient restClient;
    private final KeycloakAdminProperties properties;
    private final Clock clock;
    private volatile CachedToken cached;

    public KeycloakAdminTokenProvider(RestClient restClient, KeycloakAdminProperties properties, Clock clock) {
        this.restClient = restClient;
        this.properties = properties;
        this.clock = clock;
    }

    public String accessToken() {
        CachedToken current = cached;
        if (current != null && current.isValidAt(clock.instant())) {
            return current.value();
        }
        synchronized (this) {
            current = cached;
            if (current == null || !current.isValidAt(clock.instant())) {
                current = fetch();
                cached = current;
            }
            return current.value();
        }
    }

    public void invalidate() {
        cached = null;
    }

    private CachedToken fetch() {
        if (!properties.hasClientSecret()) {
            throw new IdentityProviderUnavailableException(
                    "La administración de identidad no está configurada: falta KEYCLOAK_AUTH_SERVICE_CLIENT_SECRET.");
        }
        ClientCredentialsForm form = new ClientCredentialsForm(properties.clientId(), properties.clientSecret());
        try {
            KeycloakRepresentations.TokenResponse response = restClient.post()
                    .uri("/realms/{realm}/protocol/openid-connect/token", properties.realm())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form.body())
                    .retrieve()
                    .body(KeycloakRepresentations.TokenResponse.class);
            if (response == null || response.accessToken() == null || response.accessToken().isBlank()) {
                throw new IdentityProviderException("Keycloak no devolvió un token para la cuenta de servicio.");
            }
            long lifetime = response.expiresIn() == null ? DEFAULT_LIFETIME_SECONDS : response.expiresIn();
            Instant renewAt = clock.instant().plusSeconds(lifetime).minus(properties.tokenExpirySkew());
            return new CachedToken(response.accessToken(), renewAt);
        } catch (RestClientResponseException e) {
            log.warn("Keycloak rechazó el client_credentials de {} con HTTP {}",
                    properties.clientId(), e.getStatusCode().value());
            throw new IdentityProviderException(
                    "Keycloak rechazó las credenciales de la cuenta de servicio de auth-service (HTTP "
                            + e.getStatusCode().value() + ").");
        } catch (ResourceAccessException e) {
            log.warn("No se pudo contactar a Keycloak para obtener el token: {}", e.getClass().getSimpleName());
            throw new IdentityProviderUnavailableException("Keycloak no está disponible.");
        }
    }

    private record CachedToken(String value, Instant renewAt) {
        boolean isValidAt(Instant now) {
            return now.isBefore(renewAt);
        }

        @Override
        public String toString() {
            return "CachedToken[value=****, renewAt=" + renewAt + "]";
        }
    }
}
