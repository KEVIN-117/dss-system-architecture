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

    /** Keycloak stores post-logout redirect URIs in this attribute, separated by {@code ##}. */
    static final String POST_LOGOUT_ATTRIBUTE = "post.logout.redirect.uris";
    static final String PKCE_ATTRIBUTE = "pkce.code.challenge.method";
    private static final String URI_SEPARATOR = "##";

    static IdentityClient toDomain(KeycloakRepresentations.ClientRepresentation client) {
        String postLogout = client.attributes() == null ? null : client.attributes().get(POST_LOGOUT_ATTRIBUTE);
        List<String> postLogoutUris = postLogout == null || postLogout.isBlank()
                ? List.of()
                : java.util.Arrays.stream(postLogout.split(URI_SEPARATOR)).filter(uri -> !uri.isBlank()).toList();
        return new IdentityClient(client.id(), client.clientId(), client.name(), client.description(),
                Boolean.TRUE.equals(client.enabled()), Boolean.TRUE.equals(client.publicClient()),
                Boolean.TRUE.equals(client.bearerOnly()), Boolean.TRUE.equals(client.standardFlowEnabled()),
                Boolean.TRUE.equals(client.serviceAccountsEnabled()), client.redirectUris(), client.webOrigins(),
                postLogoutUris);
    }

    /**
     * {@code creating} adds the secure defaults of a new client: no implicit or password grant, and PKCE S256 for
     * public clients. On update only the given fields are sent; Keycloak merges attributes key by key.
     */
    static KeycloakRepresentations.ClientRepresentation toRepresentation(IdentityClientDraft client, boolean creating) {
        java.util.Map<String, String> attributes = new java.util.HashMap<>();
        if (client.postLogoutRedirectUris() != null) {
            attributes.put(POST_LOGOUT_ATTRIBUTE, String.join(URI_SEPARATOR, client.postLogoutRedirectUris()));
        }
        if (creating && Boolean.TRUE.equals(client.publicClient())) {
            attributes.put(PKCE_ATTRIBUTE, "S256");
        }
        return new KeycloakRepresentations.ClientRepresentation(null, client.clientId(), client.name(),
                client.description(), client.enabled(), client.publicClient(), null, client.standardFlowEnabled(),
                creating ? Boolean.FALSE : null, creating ? Boolean.FALSE : null, client.serviceAccountsEnabled(),
                client.redirectUris(), client.webOrigins(), creating ? "openid-connect" : null,
                attributes.isEmpty() ? null : attributes);
    }
}
