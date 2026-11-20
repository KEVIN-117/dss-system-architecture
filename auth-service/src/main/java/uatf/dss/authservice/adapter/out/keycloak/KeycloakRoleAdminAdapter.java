package uatf.dss.authservice.adapter.out.keycloak;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import uatf.dss.authservice.application.port.out.IdentityRoleAdminPort;
import uatf.dss.authservice.domain.exception.notfound.IdentityResourceNotFoundException;
import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.identity.IdentityRoleDraft;
import uatf.dss.authservice.domain.model.identity.IdentityUser;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

import static uatf.dss.authservice.adapter.out.keycloak.KeycloakAdminHttpClient.Call;

/** {@link IdentityRoleAdminPort} on {@code /roles}, {@code /clients/{id}/roles} and realm-role composites. */
class KeycloakRoleAdminAdapter implements IdentityRoleAdminPort {

    static final ParameterizedTypeReference<List<KeycloakRepresentations.RoleRepresentation>> ROLES =
            new ParameterizedTypeReference<>() {
            };
    private static final ParameterizedTypeReference<List<KeycloakRepresentations.UserRepresentation>> USERS =
            new ParameterizedTypeReference<>() {
            };

    private final KeycloakAdminHttpClient http;
    private final KeycloakClientIdResolver clients;

    KeycloakRoleAdminAdapter(KeycloakAdminHttpClient http, KeycloakClientIdResolver clients) {
        this.http = http;
        this.clients = clients;
    }

    // ---- realm roles -------------------------------------------------------------------------------------

    @Override
    public List<IdentityRole> listRealmRoles() {
        return KeycloakMappers.toDomainRoles(http.fetch(
                Call.of(HttpMethod.GET, "listar roles del realm", "/roles").query("briefRepresentation", false), ROLES));
    }

    @Override
    public Optional<IdentityRole> findRealmRole(String roleName) {
        try {
            return Optional.of(KeycloakMappers.toDomain(realmRole(roleName)));
        } catch (IdentityResourceNotFoundException notFound) {
            return Optional.empty();
        }
    }

    @Override
    public void createRealmRole(IdentityRoleDraft role) {
        http.create(Call.of(HttpMethod.POST, "crear rol " + role.name(), "/roles")
                .body(KeycloakMappers.toRepresentation(role)));
    }

    @Override
    public void updateRealmRole(String roleName, IdentityRoleDraft role) {
        http.send(Call.of(HttpMethod.PUT, "actualizar rol " + roleName, "/roles/{role}", roleName)
                .body(KeycloakMappers.toRepresentation(role)));
    }

    @Override
    public void deleteRealmRole(String roleName) {
        http.send(Call.of(HttpMethod.DELETE, "eliminar rol " + roleName, "/roles/{role}", roleName));
    }

    // ---- client roles ------------------------------------------------------------------------------------

    @Override
    public List<IdentityRole> listClientRoles(String clientId) {
        return KeycloakMappers.toDomainRoles(clientRoles(clientId));
    }

    @Override
    public Optional<IdentityRole> findClientRole(String clientId, String roleName) {
        String internalId = clients.internalId(clientId);
        try {
            return Optional.of(KeycloakMappers.toDomain(http.fetch(
                    Call.of(HttpMethod.GET, "obtener rol " + roleName + " de " + clientId,
                            "/clients/{client}/roles/{role}", internalId, roleName),
                    KeycloakRepresentations.RoleRepresentation.class)));
        } catch (IdentityResourceNotFoundException notFound) {
            return Optional.empty();
        }
    }

    @Override
    public void createClientRole(String clientId, IdentityRoleDraft role) {
        clients.withInternalId(clientId, internalId -> http.create(
                Call.of(HttpMethod.POST, "crear rol " + role.name() + " en " + clientId, "/clients/{client}/roles", internalId)
                        .body(KeycloakMappers.toRepresentation(role))));
    }

    @Override
    public void updateClientRole(String clientId, String roleName, IdentityRoleDraft role) {
        clients.withInternalId(clientId, internalId -> {
            http.send(Call.of(HttpMethod.PUT, "actualizar rol " + roleName + " de " + clientId,
                            "/clients/{client}/roles/{role}", internalId, roleName)
                    .body(KeycloakMappers.toRepresentation(role)));
            return null;
        });
    }

    @Override
    public void deleteClientRole(String clientId, String roleName) {
        clients.withInternalId(clientId, internalId -> {
            http.send(Call.of(HttpMethod.DELETE, "eliminar rol " + roleName + " de " + clientId,
                    "/clients/{client}/roles/{role}", internalId, roleName));
            return null;
        });
    }

    // ---- composites --------------------------------------------------------------------------------------

    @Override
    public List<IdentityRole> listRealmRoleClientComposites(String realmRoleName, String clientId) {
        return KeycloakMappers.toDomainRoles(clients.withInternalId(clientId, internalId -> http.fetch(
                Call.of(HttpMethod.GET, "listar compuestos de " + realmRoleName + " en " + clientId,
                        "/roles/{role}/composites/clients/{client}", realmRoleName, internalId),
                ROLES)));
    }

    @Override
    public void addClientCompositesToRealmRole(String realmRoleName, String clientId, Set<String> clientRoleNames) {
        if (clientRoleNames.isEmpty()) {
            return;
        }
        List<KeycloakRepresentations.RoleRepresentation> references = clientRoleReferences(clientId, clientRoleNames);
        http.send(Call.of(HttpMethod.POST, "agregar compuestos a " + realmRoleName, "/roles/{role}/composites", realmRoleName)
                .body(references));
    }

    @Override
    public void removeClientCompositesFromRealmRole(String realmRoleName, String clientId, Set<String> clientRoleNames) {
        if (clientRoleNames.isEmpty()) {
            return;
        }
        List<KeycloakRepresentations.RoleRepresentation> references = clientRoleReferences(clientId, clientRoleNames);
        http.send(Call.of(HttpMethod.DELETE, "quitar compuestos de " + realmRoleName, "/roles/{role}/composites", realmRoleName)
                .body(references));
    }

    // ---- holders -----------------------------------------------------------------------------------------

    @Override
    public List<IdentityUser> listUsersWithRealmRole(String roleName, int first, int max) {
        return KeycloakMappers.toDomainUsers(http.fetch(
                Call.of(HttpMethod.GET, "usuarios con rol " + roleName, "/roles/{role}/users", roleName)
                        .query("first", first).query("max", max).query("briefRepresentation", false),
                USERS));
    }

    @Override
    public List<IdentityUser> listUsersWithClientRole(String clientId, String roleName, int first, int max) {
        return KeycloakMappers.toDomainUsers(clients.withInternalId(clientId, internalId -> http.fetch(
                Call.of(HttpMethod.GET, "usuarios con " + roleName + " de " + clientId,
                                "/clients/{client}/roles/{role}/users", internalId, roleName)
                        .query("first", first).query("max", max).query("briefRepresentation", false),
                USERS)));
    }

    // ---- helpers shared with the role-mapping adapter ----------------------------------------------------

    KeycloakRepresentations.RoleRepresentation realmRole(String roleName) {
        return http.fetch(Call.of(HttpMethod.GET, "obtener rol " + roleName, "/roles/{role}", roleName),
                KeycloakRepresentations.RoleRepresentation.class);
    }

    List<KeycloakRepresentations.RoleRepresentation> clientRoles(String clientId) {
        return clients.withInternalId(clientId, internalId -> http.fetch(
                Call.of(HttpMethod.GET, "listar roles de " + clientId, "/clients/{client}/roles", internalId)
                        .query("briefRepresentation", false),
                ROLES));
    }

    /** Resolves role names to the {@code id + name} references the API expects; fails listing every unknown name. */
    List<KeycloakRepresentations.RoleRepresentation> clientRoleReferences(String clientId, Set<String> names) {
        List<KeycloakRepresentations.RoleRepresentation> existing = clientRoles(clientId);
        List<KeycloakRepresentations.RoleRepresentation> found = existing == null ? List.of() : existing.stream()
                .filter(role -> names.contains(role.name()))
                .map(KeycloakRepresentations.RoleRepresentation::reference)
                .toList();
        if (found.size() != names.size()) {
            Set<String> missing = new TreeSet<>(names);
            found.forEach(role -> missing.remove(role.name()));
            throw new IdentityResourceNotFoundException(
                    "No existen en Keycloak los roles " + missing + " del cliente " + clientId + ".");
        }
        return found;
    }
}
