package uatf.dss.authservice.adapter.out.keycloak;

import org.springframework.http.HttpMethod;
import uatf.dss.authservice.application.port.out.IdentityRoleMappingPort;
import uatf.dss.authservice.domain.model.identity.IdentityRole;

import java.util.List;
import java.util.Set;

import static uatf.dss.authservice.adapter.out.keycloak.KeycloakAdminHttpClient.Call;
import static uatf.dss.authservice.adapter.out.keycloak.KeycloakRoleAdminAdapter.ROLES;

/** {@link IdentityRoleMappingPort} on {@code /users/{id}/role-mappings}. */
class KeycloakRoleMappingAdapter implements IdentityRoleMappingPort {

    private final KeycloakAdminHttpClient http;
    private final KeycloakClientIdResolver clients;
    private final KeycloakRoleAdminAdapter roles;

    KeycloakRoleMappingAdapter(KeycloakAdminHttpClient http, KeycloakClientIdResolver clients,
                               KeycloakRoleAdminAdapter roles) {
        this.http = http;
        this.clients = clients;
        this.roles = roles;
    }

    @Override
    public List<IdentityRole> listUserRealmRoles(String userId, boolean effective) {
        String path = effective ? "/users/{id}/role-mappings/realm/composite" : "/users/{id}/role-mappings/realm";
        return KeycloakMappers.toDomainRoles(http.fetch(
                Call.of(HttpMethod.GET, "roles del realm de " + userId, path, userId)
                        .query("briefRepresentation", effective ? false : null),
                ROLES));
    }

    @Override
    public void addUserRealmRoles(String userId, Set<String> roleNames) {
        if (roleNames.isEmpty()) {
            return;
        }
        http.send(Call.of(HttpMethod.POST, "asignar roles del realm a " + userId, "/users/{id}/role-mappings/realm", userId)
                .body(realmRoleReferences(roleNames)));
    }

    @Override
    public void removeUserRealmRoles(String userId, Set<String> roleNames) {
        if (roleNames.isEmpty()) {
            return;
        }
        http.send(Call.of(HttpMethod.DELETE, "quitar roles del realm a " + userId, "/users/{id}/role-mappings/realm", userId)
                .body(realmRoleReferences(roleNames)));
    }

    @Override
    public List<IdentityRole> listUserClientRoles(String userId, String clientId, boolean effective) {
        String path = effective
                ? "/users/{id}/role-mappings/clients/{client}/composite"
                : "/users/{id}/role-mappings/clients/{client}";
        return KeycloakMappers.toDomainRoles(clients.withInternalId(clientId, internalId -> http.fetch(
                Call.of(HttpMethod.GET, "roles de " + clientId + " de " + userId, path, userId, internalId)
                        .query("briefRepresentation", effective ? false : null),
                ROLES)));
    }

    @Override
    public void addUserClientRoles(String userId, String clientId, Set<String> roleNames) {
        if (roleNames.isEmpty()) {
            return;
        }
        List<KeycloakRepresentations.RoleRepresentation> references = roles.clientRoleReferences(clientId, roleNames);
        clients.withInternalId(clientId, internalId -> {
            http.send(Call.of(HttpMethod.POST, "asignar roles de " + clientId + " a " + userId,
                    "/users/{id}/role-mappings/clients/{client}", userId, internalId).body(references));
            return null;
        });
    }

    @Override
    public void removeUserClientRoles(String userId, String clientId, Set<String> roleNames) {
        if (roleNames.isEmpty()) {
            return;
        }
        List<KeycloakRepresentations.RoleRepresentation> references = roles.clientRoleReferences(clientId, roleNames);
        clients.withInternalId(clientId, internalId -> {
            http.send(Call.of(HttpMethod.DELETE, "quitar roles de " + clientId + " a " + userId,
                    "/users/{id}/role-mappings/clients/{client}", userId, internalId).body(references));
            return null;
        });
    }

    private List<KeycloakRepresentations.RoleRepresentation> realmRoleReferences(Set<String> roleNames) {
        return roleNames.stream().sorted()
                .map(roles::realmRole)
                .map(KeycloakRepresentations.RoleRepresentation::reference)
                .toList();
    }
}
