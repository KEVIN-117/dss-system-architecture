package uatf.dss.authservice.adapter.out.keycloak;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import uatf.dss.authservice.application.port.out.IdentityClientAdminPort;
import uatf.dss.authservice.domain.exception.notfound.IdentityResourceNotFoundException;
import uatf.dss.authservice.domain.exception.upstream.IdentityProviderException;
import uatf.dss.authservice.domain.model.identity.IdentityClient;
import uatf.dss.authservice.domain.model.identity.IdentityClientDraft;

import java.util.List;
import java.util.Optional;

import static uatf.dss.authservice.adapter.out.keycloak.KeycloakAdminHttpClient.Call;

/** {@link IdentityClientAdminPort} on {@code /admin/realms/{realm}/clients}. Secrets are returned, never logged. */
class KeycloakClientAdminAdapter implements IdentityClientAdminPort {

    private static final ParameterizedTypeReference<List<KeycloakRepresentations.ClientRepresentation>> CLIENTS =
            new ParameterizedTypeReference<>() {
            };

    private final KeycloakAdminHttpClient http;
    private final KeycloakClientIdResolver clients;

    KeycloakClientAdminAdapter(KeycloakAdminHttpClient http, KeycloakClientIdResolver clients) {
        this.http = http;
        this.clients = clients;
    }

    @Override
    public List<IdentityClient> listClients(String clientIdSearch, int first, int max) {
        boolean search = clientIdSearch != null && !clientIdSearch.isBlank();
        List<KeycloakRepresentations.ClientRepresentation> found = http.fetch(
                Call.of(HttpMethod.GET, "listar clientes", "/clients")
                        .query("clientId", search ? clientIdSearch.trim() : null)
                        .query("search", search ? true : null)
                        .query("first", first)
                        .query("max", max),
                CLIENTS);
        return found == null ? List.of() : found.stream().map(KeycloakMappers::toDomain).toList();
    }

    @Override
    public Optional<IdentityClient> findClient(String clientId) {
        try {
            KeycloakRepresentations.ClientRepresentation client = clients.withInternalId(clientId, internalId -> http.fetch(
                    Call.of(HttpMethod.GET, "obtener cliente " + clientId, "/clients/{client}", internalId),
                    KeycloakRepresentations.ClientRepresentation.class));
            return Optional.of(KeycloakMappers.toDomain(client));
        } catch (IdentityResourceNotFoundException notFound) {
            return Optional.empty();
        }
    }

    @Override
    public String createClient(IdentityClientDraft client) {
        String internalId = http.create(Call.of(HttpMethod.POST, "crear cliente " + client.clientId(), "/clients")
                .body(KeycloakMappers.toRepresentation(client, true)));
        clients.forget(client.clientId());
        return internalId;
    }

    @Override
    public void updateClient(String clientId, IdentityClientDraft changes) {
        IdentityClientDraft withoutRename = new IdentityClientDraft(clientId, changes.name(), changes.description(),
                changes.enabled(), changes.publicClient(), changes.standardFlowEnabled(),
                changes.serviceAccountsEnabled(), changes.redirectUris(), changes.webOrigins(),
                changes.postLogoutRedirectUris());
        clients.withInternalId(clientId, internalId -> {
            http.send(Call.of(HttpMethod.PUT, "actualizar cliente " + clientId, "/clients/{client}", internalId)
                    .body(KeycloakMappers.toRepresentation(withoutRename, false)));
            return null;
        });
    }

    @Override
    public String regenerateClientSecret(String clientId) {
        KeycloakRepresentations.CredentialRepresentation credential = clients.withInternalId(clientId, internalId ->
                http.fetch(Call.of(HttpMethod.POST, "regenerar secreto de " + clientId,
                        "/clients/{client}/client-secret", internalId), KeycloakRepresentations.CredentialRepresentation.class));
        if (credential == null || credential.value() == null || credential.value().isBlank()) {
            throw new IdentityProviderException("Keycloak no devolvió el nuevo secreto de " + clientId + ".");
        }
        return credential.value();
    }
}
