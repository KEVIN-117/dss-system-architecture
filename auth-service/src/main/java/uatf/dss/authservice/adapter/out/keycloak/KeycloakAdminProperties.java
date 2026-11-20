package uatf.dss.authservice.adapter.out.keycloak;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Connection to the Keycloak Admin REST API with the {@code uatf-auth-service} service account
 * ({@code client_credentials}). {@link #toString()} never prints the secret.
 *
 * @param baseUrl          Keycloak server URL without the realm, e.g. {@code http://keycloak:8080}
 * @param realm            realm to administer
 * @param clientId         confidential client whose service account calls the API
 * @param clientSecret     secret of {@code clientId}; blank makes every call fail with 503
 * @param connectTimeout   TCP connect timeout
 * @param readTimeout      response timeout
 * @param maxRetries       extra attempts for idempotent calls (GET, PUT, DELETE) on I/O errors and 502/503/504
 * @param retryBackoff     wait before the first retry; doubled on each further retry
 * @param tokenExpirySkew  the cached token is renewed this long before it expires
 */
@ConfigurationProperties(prefix = "app.keycloak.admin")
public record KeycloakAdminProperties(
        String baseUrl,
        String realm,
        String clientId,
        String clientSecret,
        Duration connectTimeout,
        Duration readTimeout,
        Integer maxRetries,
        Duration retryBackoff,
        Duration tokenExpirySkew) {

    public KeycloakAdminProperties {
        baseUrl = stripTrailingSlash(baseUrl == null || baseUrl.isBlank() ? "http://localhost:8080" : baseUrl.trim());
        realm = realm == null || realm.isBlank() ? "uatf-dss-realm" : realm.trim();
        clientId = clientId == null || clientId.isBlank() ? "uatf-auth-service" : clientId.trim();
        connectTimeout = connectTimeout == null ? Duration.ofSeconds(2) : connectTimeout;
        readTimeout = readTimeout == null ? Duration.ofSeconds(5) : readTimeout;
        maxRetries = maxRetries == null || maxRetries < 0 ? 2 : maxRetries;
        retryBackoff = retryBackoff == null ? Duration.ofMillis(200) : retryBackoff;
        tokenExpirySkew = tokenExpirySkew == null ? Duration.ofSeconds(30) : tokenExpirySkew;
    }

    public boolean hasClientSecret() {
        return clientSecret != null && !clientSecret.isBlank();
    }

    private static String stripTrailingSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    @Override
    public String toString() {
        return "KeycloakAdminProperties[baseUrl=" + baseUrl + ", realm=" + realm + ", clientId=" + clientId
                + ", clientSecret=" + (hasClientSecret() ? "****" : "<unset>") + ", connectTimeout=" + connectTimeout
                + ", readTimeout=" + readTimeout + ", maxRetries=" + maxRetries + ", retryBackoff=" + retryBackoff
                + ", tokenExpirySkew=" + tokenExpirySkew + "]";
    }
}
