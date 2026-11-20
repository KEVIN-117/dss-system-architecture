package uatf.dss.authservice.adapter.out.keycloak;

import org.springframework.http.StreamingHttpOutputMessage;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Body of a {@code client_credentials} token request. Spring's {@code DefaultRestClient} logs request bodies that go
 * through message converters at DEBUG ("Writing [...]"); a form map would print the client secret. This type is sent
 * as a streaming body, which bypasses that logging, and its {@code toString()} masks the secret, so the secret never
 * reaches a log at any level.
 */
record ClientCredentialsForm(String clientId, String clientSecret) {

    @Override
    public String toString() {
        return "ClientCredentialsForm[grant_type=client_credentials, client_id=" + clientId + ", client_secret=****]";
    }

    /** {@code application/x-www-form-urlencoded} body, written directly to the request stream. */
    StreamingHttpOutputMessage.Body body() {
        byte[] payload = ("grant_type=client_credentials"
                + "&client_id=" + URLEncoder.encode(clientId, StandardCharsets.UTF_8)
                + "&client_secret=" + URLEncoder.encode(clientSecret, StandardCharsets.UTF_8))
                .getBytes(StandardCharsets.UTF_8);
        return outputStream -> outputStream.write(payload);
    }
}
