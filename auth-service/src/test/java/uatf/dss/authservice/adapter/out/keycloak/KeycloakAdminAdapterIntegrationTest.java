package uatf.dss.authservice.adapter.out.keycloak;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.testcontainers.junit.jupiter.Testcontainers;
import uatf.dss.authservice.KeycloakTestRealm;
import uatf.dss.authservice.domain.exception.conflict.IdentityResourceConflictException;
import uatf.dss.authservice.domain.exception.notfound.IdentityResourceNotFoundException;
import uatf.dss.authservice.domain.exception.upstream.IdentityProviderException;
import uatf.dss.authservice.domain.model.identity.IdentityClient;
import uatf.dss.authservice.domain.model.identity.IdentityClientDraft;
import uatf.dss.authservice.domain.model.identity.IdentityRequiredAction;
import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.identity.IdentityRoleDraft;
import uatf.dss.authservice.domain.model.identity.IdentityUser;
import uatf.dss.authservice.domain.model.identity.IdentityUserChanges;
import uatf.dss.authservice.domain.model.identity.NewIdentityUser;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Runs every operation of the four identity ports against a real Keycloak that imports the repository realm
 * ({@code infra/keycloak/realm/uatf-dss-realm-realm.json}) and authenticates with the least-privilege
 * {@code uatf-auth-service} service account from IAM-001.
 */
@Testcontainers(disabledWithoutDocker = true)
class KeycloakAdminAdapterIntegrationTest {

    private static final String REALM = KeycloakTestRealm.REALM;
    private static final String AUTH_SERVICE_SECRET = KeycloakTestRealm.AUTH_SERVICE_SECRET;
    private static final String PERMISSIONS = "dss-permissions";

    private static KeycloakAdminModule module;

    private static String baseUrl() {
        return KeycloakTestRealm.baseUrl();
    }

    @BeforeAll
    static void createModule() {
        module = KeycloakAdminModule.create(new KeycloakAdminProperties(baseUrl(), REALM, "uatf-auth-service",
                AUTH_SERVICE_SECRET, Duration.ofSeconds(2), Duration.ofSeconds(10), 2, Duration.ofMillis(200),
                Duration.ofSeconds(30)), Clock.systemUTC());
    }

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private static String createUser(String username) {
        return module.users().createUser(new NewIdentityUser(username, username + "@probe.test", "Ánfora", "Núñez",
                true, false));
    }

    // ---- users -------------------------------------------------------------------------------------------

    @Test
    void createsFindsSearchesUpdatesAndDeletesUsers() {
        String username = unique("iam003-user");
        String id = createUser(username);

        IdentityUser created = module.users().findUserById(id).orElseThrow();
        assertThat(created.username()).isEqualTo(username);
        assertThat(created.firstName()).isEqualTo("Ánfora");
        assertThat(created.lastName()).isEqualTo("Núñez");
        assertThat(created.enabled()).isTrue();
        assertThat(module.users().findUserByUsername(username)).map(IdentityUser::id).contains(id);
        assertThat(module.users().searchUsers(username, 0, 10)).extracting(IdentityUser::id).containsExactly(id);
        assertThat(module.users().countUsers(username)).isEqualTo(1);

        module.users().updateUser(id, new IdentityUserChanges(null, "Ana", null, false, null));
        IdentityUser updated = module.users().findUserById(id).orElseThrow();
        assertThat(updated.firstName()).isEqualTo("Ana");
        assertThat(updated.lastName()).as("null fields are left unchanged").isEqualTo("Núñez");
        assertThat(updated.email()).isEqualTo(username + "@probe.test");
        assertThat(updated.enabled()).isFalse();

        module.users().deleteUser(id);
        assertThat(module.users().findUserById(id)).isEmpty();
        assertThat(module.users().findUserByUsername(username)).isEmpty();
    }

    @Test
    void duplicateUsernameIsAConflict() {
        String username = unique("iam003-dup");
        createUser(username);

        assertThatThrownBy(() -> createUser(username)).isInstanceOf(IdentityResourceConflictException.class);
    }

    @Test
    void requiredActionsEmailReachesKeycloakAndFailsCleanlyWithoutSmtp() {
        String id = createUser(unique("iam003-mail"));

        // The test realm has no SMTP server: Keycloak accepts the call and answers 500, which must become a 502.
        assertThatThrownBy(() -> module.users().sendRequiredActionsEmail(id,
                Set.of(IdentityRequiredAction.UPDATE_PASSWORD, IdentityRequiredAction.VERIFY_EMAIL), Duration.ofHours(12)))
                .isInstanceOf(IdentityProviderException.class);
    }

    @Test
    void unknownIdsAreEmptyOrNotFound() {
        assertThat(module.users().findUserById(UUID.randomUUID().toString())).isEmpty();
        assertThat(module.roles().findRealmRole("NO_SUCH_ROLE")).isEmpty();
        assertThat(module.roles().findClientRole(PERMISSIONS, "no:such")).isEmpty();
        assertThat(module.clients().findClient("no-such-client")).isEmpty();
        assertThatThrownBy(() -> module.users().deleteUser(UUID.randomUUID().toString()))
                .isInstanceOf(IdentityResourceNotFoundException.class);
        assertThatThrownBy(() -> module.roles().listClientRoles("no-such-client"))
                .isInstanceOf(IdentityResourceNotFoundException.class);
    }

    // ---- roles, permissions and composites ---------------------------------------------------------------

    @Test
    void readsTheImportedPermissionModel() {
        assertThat(module.roles().listRealmRoles()).extracting(IdentityRole::name)
                .contains("SUPERADMIN", "RECTOR", "DECANO", "DIRECTOR");
        assertThat(module.roles().listClientRoles(PERMISSIONS)).extracting(IdentityRole::name)
                .contains("analytics:read", "dw:closure:manage", "iam:users:write");
        assertThat(module.roles().findClientRole(PERMISSIONS, "dw:closure:manage")).get()
                .satisfies(role -> {
                    assertThat(role.clientRole()).isTrue();
                    assertThat(role.description()).isEqualTo("Crear y gestionar cierres académicos.");
                });
        assertThat(module.roles().listRealmRoleClientComposites("DECANO", PERMISSIONS)).extracting(IdentityRole::name)
                .containsExactlyInAnyOrder("analytics:read", "analytics:career", "analytics:faculty", "pipelines:read",
                        "prediction:forecast:read");
    }

    @Test
    void managesRealmRolesClientRolesAndComposites() {
        String roleName = unique("IAM003_ROLE");
        String permission = "iam003:" + UUID.randomUUID().toString().substring(0, 8);

        module.roles().createRealmRole(new IdentityRoleDraft(roleName, "Rol de prueba con acentos: académico",
                Map.of("portal", List.of("director"))));
        module.roles().createClientRole(PERMISSIONS, new IdentityRoleDraft(permission, "Permiso de prueba", null));

        IdentityRole role = module.roles().findRealmRole(roleName).orElseThrow();
        assertThat(role.description()).isEqualTo("Rol de prueba con acentos: académico");
        assertThat(role.attributes()).containsEntry("portal", List.of("director"));
        assertThat(module.roles().findClientRole(PERMISSIONS, permission)).isPresent();

        module.roles().updateRealmRole(roleName, new IdentityRoleDraft(roleName, "Descripción nueva", null));
        module.roles().updateClientRole(PERMISSIONS, permission, new IdentityRoleDraft(permission, "Otra descripción", null));
        assertThat(module.roles().findRealmRole(roleName)).get().extracting(IdentityRole::description)
                .isEqualTo("Descripción nueva");
        assertThat(module.roles().findClientRole(PERMISSIONS, permission)).get().extracting(IdentityRole::description)
                .isEqualTo("Otra descripción");

        module.roles().addClientCompositesToRealmRole(roleName, PERMISSIONS, Set.of(permission, "analytics:read"));
        assertThat(module.roles().listRealmRoleClientComposites(roleName, PERMISSIONS)).extracting(IdentityRole::name)
                .containsExactlyInAnyOrder(permission, "analytics:read");
        assertThat(module.roles().findRealmRole(roleName)).get().extracting(IdentityRole::composite).isEqualTo(true);

        module.roles().removeClientCompositesFromRealmRole(roleName, PERMISSIONS, Set.of("analytics:read"));
        assertThat(module.roles().listRealmRoleClientComposites(roleName, PERMISSIONS)).extracting(IdentityRole::name)
                .containsExactly(permission);

        assertThatThrownBy(() -> module.roles().addClientCompositesToRealmRole(roleName, PERMISSIONS, Set.of("no:such")))
                .isInstanceOf(IdentityResourceNotFoundException.class)
                .hasMessageContaining("no:such");
        assertThatThrownBy(() -> module.roles().createRealmRole(new IdentityRoleDraft(roleName, null, null)))
                .isInstanceOf(IdentityResourceConflictException.class);

        module.roles().deleteClientRole(PERMISSIONS, permission);
        module.roles().deleteRealmRole(roleName);
        assertThat(module.roles().findRealmRole(roleName)).isEmpty();
        assertThat(module.roles().findClientRole(PERMISSIONS, permission)).isEmpty();
    }

    // ---- role mappings -----------------------------------------------------------------------------------

    @Test
    void assignsRealmRolesAndPermissionsToUsers() {
        String id = createUser(unique("iam003-map"));

        module.roleMappings().addUserRealmRoles(id, Set.of("DECANO"));
        assertThat(module.roleMappings().listUserRealmRoles(id, false)).extracting(IdentityRole::name)
                .contains("DECANO");
        assertThat(module.roleMappings().listUserClientRoles(id, PERMISSIONS, true)).extracting(IdentityRole::name)
                .as("effective permissions expand the DECANO composite")
                .containsExactlyInAnyOrder("analytics:read", "analytics:career", "analytics:faculty", "pipelines:read",
                        "prediction:forecast:read");
        assertThat(module.roleMappings().listUserClientRoles(id, PERMISSIONS, false)).isEmpty();
        assertThat(module.roles().listUsersWithRealmRole("DECANO", 0, 100)).extracting(IdentityUser::id).contains(id);

        module.roleMappings().addUserClientRoles(id, PERMISSIONS, Set.of("dw:closure:read"));
        assertThat(module.roleMappings().listUserClientRoles(id, PERMISSIONS, false)).extracting(IdentityRole::name)
                .containsExactly("dw:closure:read");
        assertThat(module.roles().listUsersWithClientRole(PERMISSIONS, "dw:closure:read", 0, 100))
                .extracting(IdentityUser::id).containsExactly(id);

        module.roleMappings().removeUserClientRoles(id, PERMISSIONS, Set.of("dw:closure:read"));
        module.roleMappings().removeUserRealmRoles(id, Set.of("DECANO"));
        assertThat(module.roleMappings().listUserRealmRoles(id, true)).extracting(IdentityRole::name)
                .doesNotContain("DECANO");
        assertThat(module.roleMappings().listUserClientRoles(id, PERMISSIONS, true)).isEmpty();

        assertThatThrownBy(() -> module.roleMappings().addUserRealmRoles(id, Set.of("NO_SUCH_ROLE")))
                .isInstanceOf(IdentityResourceNotFoundException.class);
    }

    // ---- clients -----------------------------------------------------------------------------------------

    @Test
    void listsCreatesUpdatesAndRotatesClientSecrets() {
        assertThat(module.clients().listClients(null, 0, 100)).extracting(IdentityClient::clientId)
                .contains("dss-bff", PERMISSIONS, "uatf-auth-service")
                .doesNotContain("uatf-dss-spa");
        assertThat(module.clients().listClients("dss-", 0, 100)).extracting(IdentityClient::clientId)
                .contains("dss-bff", PERMISSIONS)
                .doesNotContain("olap-service");
        assertThat(module.clients().findClient(PERMISSIONS)).get().extracting(IdentityClient::bearerOnly).isEqualTo(true);

        String clientId = unique("iam003-app");
        module.clients().createClient(new IdentityClientDraft(clientId, "Aplicación de prueba", "Descripción",
                true, false, false, true, List.of(), List.of(), null));
        assertThatThrownBy(() -> module.clients().createClient(new IdentityClientDraft(clientId, null, null,
                true, false, false, true, null, null, null)))
                .isInstanceOf(IdentityResourceConflictException.class);

        module.clients().updateClient(clientId, new IdentityClientDraft(null, "Aplicación renombrada", null,
                null, null, true, null, List.of("https://app.uatf.test/callback"), List.of("https://app.uatf.test"),
                List.of("https://app.uatf.test/", "https://app.uatf.test/adios")));
        IdentityClient updated = module.clients().findClient(clientId).orElseThrow();
        assertThat(updated.name()).isEqualTo("Aplicación renombrada");
        assertThat(updated.description()).isEqualTo("Descripción");
        assertThat(updated.standardFlowEnabled()).isTrue();
        assertThat(updated.serviceAccountsEnabled()).isTrue();
        assertThat(updated.redirectUris()).containsExactly("https://app.uatf.test/callback");
        assertThat(updated.postLogoutRedirectUris())
                .containsExactly("https://app.uatf.test/", "https://app.uatf.test/adios");

        String secret = module.clients().regenerateClientSecret(clientId);
        assertThat(secret).isNotBlank();
        assertThat(clientCredentialsToken(clientId, secret)).as("the rotated secret authenticates").isNotBlank();
    }

    private static String clientCredentialsToken(String clientId, String secret) {
        LinkedMultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");
        form.add("client_id", clientId);
        form.add("client_secret", secret);
        Map<?, ?> response = RestClient.create(baseUrl()).post()
                .uri("/realms/{realm}/protocol/openid-connect/token", REALM)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(Map.class);
        return response == null ? null : (String) response.get("access_token");
    }

    // ---- service account boundaries ---------------------------------------------------------------------

    @Test
    void wrongServiceAccountSecretIsRejected() {
        KeycloakAdminModule wrong = KeycloakAdminModule.create(new KeycloakAdminProperties(baseUrl(), REALM,
                "uatf-auth-service", "not-the-secret", null, null, 0, null, null), Clock.systemUTC());

        assertThatThrownBy(() -> wrong.roles().listRealmRoles())
                .isInstanceOf(IdentityProviderException.class)
                .hasMessageContaining("credenciales");
    }
}
