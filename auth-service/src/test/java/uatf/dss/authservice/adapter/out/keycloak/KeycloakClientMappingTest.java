package uatf.dss.authservice.adapter.out.keycloak;

import org.junit.jupiter.api.Test;
import uatf.dss.authservice.domain.model.identity.IdentityClient;
import uatf.dss.authservice.domain.model.identity.IdentityClientDraft;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class KeycloakClientMappingTest {

    @Test
    void newClientsGetSecureDefaultsAndPublicOnesRequirePkce() {
        IdentityClientDraft publicApp = new IdentityClientDraft("portal-becas", "Becas", null, true, true, true, false,
                List.of("https://becas.uatf.edu.bo/*"), List.of("+"), List.of("https://becas.uatf.edu.bo/"));

        KeycloakRepresentations.ClientRepresentation created = KeycloakMappers.toRepresentation(publicApp, true);

        assertThat(created.implicitFlowEnabled()).isFalse();
        assertThat(created.directAccessGrantsEnabled()).isFalse();
        assertThat(created.protocol()).isEqualTo("openid-connect");
        assertThat(created.attributes())
                .containsEntry(KeycloakMappers.PKCE_ATTRIBUTE, "S256")
                .containsEntry(KeycloakMappers.POST_LOGOUT_ATTRIBUTE, "https://becas.uatf.edu.bo/");
    }

    @Test
    void updatesOnlySendTheGivenFields() {
        IdentityClientDraft changes = new IdentityClientDraft("portal-becas", "Nuevo", null, null, null, null, null,
                null, null, null);

        KeycloakRepresentations.ClientRepresentation update = KeycloakMappers.toRepresentation(changes, false);

        assertThat(update.implicitFlowEnabled()).isNull();
        assertThat(update.directAccessGrantsEnabled()).isNull();
        assertThat(update.protocol()).isNull();
        assertThat(update.attributes()).as("no attribute is touched").isNull();
        assertThat(update.redirectUris()).isNull();
    }

    @Test
    void readsPostLogoutUrisFromTheKeycloakAttribute() {
        KeycloakRepresentations.ClientRepresentation stored = new KeycloakRepresentations.ClientRepresentation("id-1",
                "dss-bff", null, null, true, false, false, true, false, false, false, List.of(), List.of(),
                "openid-connect", Map.of(KeycloakMappers.POST_LOGOUT_ATTRIBUTE, "http://localhost:3000/login##+"));

        IdentityClient client = KeycloakMappers.toDomain(stored);

        assertThat(client.postLogoutRedirectUris()).containsExactly("http://localhost:3000/login", "+");
    }
}
