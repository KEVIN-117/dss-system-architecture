package uatf.dss.authservice.adapter.out.keycloak;

import uatf.dss.authservice.domain.model.identity.IdentityClient;
import uatf.dss.authservice.domain.model.identity.IdentityClientDraft;
import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.identity.IdentityRoleDraft;
import uatf.dss.authservice.domain.model.identity.IdentityUser;
import uatf.dss.authservice.domain.model.identity.IdentityUserChanges;
import uatf.dss.authservice.domain.model.identity.NewIdentityUser;

import java.util.List;

/** Converts between Keycloak representations and the identity domain model. */
final class KeycloakMappers {

    private KeycloakMappers() {
    }

    static IdentityUser toDomain(KeycloakRepresentations.UserRepresentation user) {
        return new IdentityUser(user.id(), user.username(), user.email(), user.firstName(), user.lastName(),
                Boolean.TRUE.equals(user.enabled()), Boolean.TRUE.equals(user.emailVerified()), user.createdTimestamp());
    }

    static List<IdentityUser> toDomainUsers(List<KeycloakRepresentations.UserRepresentation> users) {
        return users == null ? List.of() : users.stream().map(KeycloakMappers::toDomain).toList();
    }

    static KeycloakRepresentations.UserRepresentation toRepresentation(NewIdentityUser user) {
        return new KeycloakRepresentations.UserRepresentation(null, user.username(), user.email(), user.firstName(),
                user.lastName(), user.enabled(), user.emailVerified(), null);
    }

    static KeycloakRepresentations.UserRepresentation toRepresentation(IdentityUserChanges changes) {
        return new KeycloakRepresentations.UserRepresentation(null, null, changes.email(), changes.firstName(),
                changes.lastName(), changes.enabled(), changes.emailVerified(), null);
    }

    static IdentityRole toDomain(KeycloakRepresentations.RoleRepresentation role) {
        return new IdentityRole(role.id(), role.name(), role.description(), Boolean.TRUE.equals(role.composite()),
                Boolean.TRUE.equals(role.clientRole()), role.attributes());
    }

    static List<IdentityRole> toDomainRoles(List<KeycloakRepresentations.RoleRepresentation> roles) {
        return roles == null ? List.of() : roles.stream().map(KeycloakMappers::toDomain).toList();
    }

    static KeycloakRepresentations.RoleRepresentation toRepresentation(IdentityRoleDraft role) {
        return new KeycloakRepresentations.RoleRepresentation(null, role.name(), role.description(), null, null, null,
                role.attributes());
    }

    static IdentityClient toDomain(KeycloakRepresentations.ClientRepresentation client) {
        return new IdentityClient(client.id(), client.clientId(), client.name(), client.description(),
                Boolean.TRUE.equals(client.enabled()), Boolean.TRUE.equals(client.publicClient()),
                Boolean.TRUE.equals(client.bearerOnly()), Boolean.TRUE.equals(client.standardFlowEnabled()),
                Boolean.TRUE.equals(client.serviceAccountsEnabled()), client.redirectUris(), client.webOrigins());
    }

    static KeycloakRepresentations.ClientRepresentation toRepresentation(IdentityClientDraft client, String protocol) {
        return new KeycloakRepresentations.ClientRepresentation(null, client.clientId(), client.name(),
                client.description(), client.enabled(), client.publicClient(), null, client.standardFlowEnabled(),
                client.serviceAccountsEnabled(), client.redirectUris(), client.webOrigins(), protocol);
    }
}
