package uatf.dss.authservice.domain.validator;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import uatf.dss.authservice.domain.exception.validation.ValidationException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ClientUriPolicyTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "https://becas.uatf.edu.bo/callback",
            "https://becas.uatf.edu.bo/*",
            "https://becas.uatf.edu.bo:8443/auth/callback?x=1",
            "http://localhost:3000/*",
            "http://127.0.0.1:3006/api/auth/callback"})
    void acceptsConcreteRedirectUrisEvenWhenHttpsIsRequired(String uri) {
        assertThatCode(() -> ClientUriPolicy.validateRedirectUris(List.of(uri), true, "redirectUris"))
                .doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "*", "/*", "https://*", "https://*.uatf.edu.bo/callback", "https://becas.uatf.edu.bo/*/callback",
            "https://becas.uatf.edu.bo/cb*", "becas.uatf.edu.bo/callback", "/relative/callback",
            "javascript:alert(1)", "ftp://becas.uatf.edu.bo/", "https://user:pass@becas.uatf.edu.bo/cb",
            "https://becas.uatf.edu.bo/cb#frag", " "})
    void rejectsDangerousOrMalformedRedirectUris(String uri) {
        assertThatThrownBy(() -> ClientUriPolicy.validateRedirectUris(List.of(uri), false, "redirectUris"))
                .isInstanceOf(ValidationException.class)
                .hasMessageStartingWith("redirectUris:");
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://becas.uatf.edu.bo/callback", "http://10.0.0.5/callback"})
    void requiresHttpsOutsideLoopbackWhenConfigured(String uri) {
        assertThatCode(() -> ClientUriPolicy.validateRedirectUris(List.of(uri), false, "redirectUris"))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> ClientUriPolicy.validateRedirectUris(List.of(uri), true, "redirectUris"))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("https");
    }

    @ParameterizedTest
    @ValueSource(strings = {"+", "https://becas.uatf.edu.bo", "https://becas.uatf.edu.bo:8443", "http://localhost:3000"})
    void acceptsConcreteWebOrigins(String origin) {
        assertThatCode(() -> ClientUriPolicy.validateWebOrigins(List.of(origin), true)).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {"*", "https://*.uatf.edu.bo", "https://becas.uatf.edu.bo/", "https://becas.uatf.edu.bo/app",
            "becas.uatf.edu.bo", "http://becas.uatf.edu.bo"})
    void rejectsWildcardOrPathWebOrigins(String origin) {
        assertThatThrownBy(() -> ClientUriPolicy.validateWebOrigins(List.of(origin), true))
                .isInstanceOf(ValidationException.class)
                .hasMessageStartingWith("webOrigins:");
    }
}
