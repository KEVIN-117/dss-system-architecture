package uatf.dss.authservice.adapter.in.web;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import uatf.dss.authservice.KeycloakTestRealm;
import uatf.dss.authservice.TestcontainersConfiguration;
import uatf.dss.authservice.application.port.out.IdentityRoleAdminPort;
import uatf.dss.authservice.application.port.out.IdentityRoleMappingPort;
import uatf.dss.authservice.application.port.out.IdentityUserAdminPort;
import uatf.dss.authservice.domain.model.identity.IdentityUser;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Every {@code /admin/iam/users} endpoint over HTTP against a real Keycloak (repository realm, IAM-001
 * service account) and a real PostgreSQL. Checks the Keycloak state, the local user copy and the audit log.
 * The test realm has no SMTP server, so e-mails fail in a controlled way.
 */
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DisplayName("IAM user administration API (Keycloak + PostgreSQL)")
class IamUserControllerIntegrationTest {

    private static final String ADMIN_KEYCLOAK_ID = UUID.randomUUID().toString();
    private static final String BASE = "/admin/iam/users";

    @DynamicPropertySource
    static void keycloak(DynamicPropertyRegistry registry) {
        registry.add("app.keycloak.admin.base-url", KeycloakTestRealm::baseUrl);
        registry.add("app.keycloak.admin.realm", () -> KeycloakTestRealm.REALM);
        registry.add("app.keycloak.admin.client-id", () -> KeycloakTestRealm.AUTH_SERVICE_CLIENT_ID);
        registry.add("app.keycloak.admin.client-secret", () -> KeycloakTestRealm.AUTH_SERVICE_SECRET);
    }

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private JsonMapper jsonMapper;
    @Autowired
    private IdentityUserAdminPort identityUsers;
    @Autowired
    private IdentityRoleAdminPort identityRoles;
    @Autowired
    private IdentityRoleMappingPort identityMappings;

    @BeforeEach
    void cleanAudit() {
        jdbcTemplate.execute("TRUNCATE TABLE admin_audit_log");
    }

    // ---- helpers -------------------------------------------------------------------------------------------

    private static RequestPostProcessor admin() {
        return actingAs(ADMIN_KEYCLOAK_ID);
    }

    private static RequestPostProcessor actingAs(String keycloakId) {
        return jwt().jwt(token -> token.subject(keycloakId).claim("preferred_username", "ana.admin"))
                .authorities(new SimpleGrantedAuthority("iam:users:read"), new SimpleGrantedAuthority("iam:users:write"));
    }

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return jsonMapper.readTree(result.getResponse().getContentAsString());
    }

    private String body(Object value) {
        return jsonMapper.writeValueAsString(value);
    }

    /** Creates a user through the API and returns its local id. */
    private UUID createUser(String username) throws Exception {
        MvcResult result = mockMvc.perform(post(BASE).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("username", username, "email", username + "@uatf.test",
                                "firstName", "Prueba", "lastName", "IAM", "sendInvitation", false))))
                .andExpect(status().isCreated())
                .andReturn();
        return UUID.fromString(json(result).get("id").asString());
    }

    private String keycloakIdOf(UUID localId) {
        return jdbcTemplate.queryForObject("SELECT keycloak_id::text FROM users WHERE id = ?", String.class, localId);
    }

    private List<Map<String, Object>> audit(String action) {
        return jdbcTemplate.queryForList(
                "SELECT outcome, target_id, actor_username, failure_reason FROM admin_audit_log WHERE action = ? "
                        + "ORDER BY occurred_at", action);
    }

    /** Leaves {@code keepKeycloakId} as the only enabled SUPERADMIN of the shared realm. */
    private void makeOnlySuperadmin(String keepKeycloakId) {
        identityMappings.addUserRealmRoles(keepKeycloakId, Set.of("SUPERADMIN"));
        for (IdentityUser holder : identityRoles.listUsersWithRealmRole("SUPERADMIN", 0, 1000)) {
            if (!holder.id().equals(keepKeycloakId)) {
                identityMappings.removeUserRealmRoles(holder.id(), Set.of("SUPERADMIN"));
            }
        }
    }

    // ---- POST /admin/iam/users -----------------------------------------------------------------------------

    @Test
    @DisplayName("POST creates the user in Keycloak and locally, reports the failed invitation, and audits both")
    void createsUser() throws Exception {
        String username = unique("iam006-create");

        MvcResult result = mockMvc.perform(post(BASE).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("username", username, "email", username + "@uatf.test",
                                "firstName", "Ánfora", "lastName", "Núñez"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.firstName").value("Ánfora"))
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.invitationSent").value(false))
                .andExpect(jsonPath("$.keycloakId").doesNotExist())
                .andReturn();

        UUID localId = UUID.fromString(json(result).get("id").asString());
        assertThat(result.getResponse().getHeader("Location")).isEqualTo("/admin/users/" + localId);
        assertThat(identityUsers.findUserByUsername(username)).get()
                .satisfies(user -> assertThat(user.id()).isEqualTo(keycloakIdOf(localId)));
        assertThat(audit("USER_CREATED")).singleElement()
                .satisfies(row -> {
                    assertThat(row.get("outcome")).isEqualTo("SUCCESS");
                    assertThat(row.get("actor_username")).isEqualTo("ana.admin");
                });
        assertThat(audit("USER_ACTIONS_EMAIL_SENT")).singleElement()
                .satisfies(row -> assertThat(row.get("outcome")).as("no SMTP in the test realm").isEqualTo("FAILURE"));
    }

    @Test
    @DisplayName("POST rejects duplicates (409, audited) and invalid input (400)")
    void createRejectsDuplicatesAndInvalidInput() throws Exception {
        String username = unique("iam006-dup");
        createUser(username);
        jdbcTemplate.execute("TRUNCATE TABLE admin_audit_log");

        mockMvc.perform(post(BASE).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("username", username, "email", "otro-" + username + "@uatf.test",
                                "sendInvitation", false))))
                .andExpect(status().isConflict());
        assertThat(audit("USER_CREATED")).singleElement()
                .satisfies(row -> assertThat(row.get("outcome")).isEqualTo("FAILURE"));

        mockMvc.perform(post(BASE).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("username", "x y", "email", "no-es-correo"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Writes require iam:users:write and reads iam:users:read")
    void requiresPermissions() throws Exception {
        UUID localId = createUser(unique("iam006-perm"));

        mockMvc.perform(post(BASE).with(jwt().authorities(new SimpleGrantedAuthority("iam:users:read")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("username", unique("x"), "email", "x@uatf.test"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/{id}/roles", localId)
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_SUPERADMIN"))))
                .andExpect(status().isForbidden());
    }

    // ---- PATCH /admin/iam/users/{id} ------------------------------------------------------------------------

    @Test
    @DisplayName("PATCH updates basic data and disables the user in Keycloak and locally")
    void updatesUser() throws Exception {
        UUID localId = createUser(unique("iam006-upd"));

        mockMvc.perform(patch(BASE + "/{id}", localId).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("firstName", "Renombrada", "enabled", false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Renombrada"))
                .andExpect(jsonPath("$.lastName").value("IAM"))
                .andExpect(jsonPath("$.enabled").value(false));

        assertThat(identityUsers.findUserById(keycloakIdOf(localId))).get()
                .satisfies(user -> assertThat(user.enabled()).isFalse());
        assertThat(jdbcTemplate.queryForObject("SELECT is_active FROM users WHERE id = ?", Boolean.class, localId))
                .as("local copy refreshed without waiting for the event").isFalse();
        assertThat(jdbcTemplate.queryForObject("SELECT first_name FROM users WHERE id = ?", String.class, localId))
                .isEqualTo("Renombrada");
        assertThat(audit("USER_UPDATED")).singleElement()
                .satisfies(row -> assertThat(row.get("outcome")).isEqualTo("SUCCESS"));
    }

    @Test
    @DisplayName("PATCH refuses to let an administrator disable their own account (409, audited)")
    void cannotDisableOwnAccount() throws Exception {
        UUID localId = createUser(unique("iam006-self"));

        mockMvc.perform(patch(BASE + "/{id}", localId).with(actingAs(keycloakIdOf(localId)))
                        .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("enabled", false))))
                .andExpect(status().isConflict());

        assertThat(identityUsers.findUserById(keycloakIdOf(localId))).get()
                .satisfies(user -> assertThat(user.enabled()).isTrue());
        assertThat(audit("USER_UPDATED")).singleElement()
                .satisfies(row -> assertThat((String) row.get("failure_reason")).contains("propia cuenta"));
    }

    @Test
    @DisplayName("Unknown local user ids answer 404")
    void unknownUserIsNotFound() throws Exception {
        mockMvc.perform(patch(BASE + "/{id}", UUID.randomUUID()).with(admin())
                        .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("firstName", "X"))))
                .andExpect(status().isNotFound());
    }

    // ---- POST /admin/iam/users/{id}/actions-email -------------------------------------------------------------

    @Test
    @DisplayName("POST actions-email reaches Keycloak; without SMTP it answers 502 and is audited as FAILURE")
    void sendsActionsEmail() throws Exception {
        UUID localId = createUser(unique("iam006-mail"));

        mockMvc.perform(post(BASE + "/{id}/actions-email", localId).with(admin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("actions", List.of("UPDATE_PASSWORD"), "lifespanHours", 24))))
                .andExpect(status().isBadGateway());
        assertThat(audit("USER_ACTIONS_EMAIL_SENT")).singleElement()
                .satisfies(row -> assertThat(row.get("outcome")).isEqualTo("FAILURE"));

        mockMvc.perform(post(BASE + "/{id}/actions-email", localId).with(admin())
                        .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("actions", List.of()))))
                .andExpect(status().isBadRequest());
    }

    // ---- GET/PUT /admin/iam/users/{id}/roles -----------------------------------------------------------------

    @Test
    @DisplayName("PUT roles replaces direct realm roles and updates the local role snapshot")
    void replacesRoles() throws Exception {
        UUID localId = createUser(unique("iam006-roles"));

        mockMvc.perform(put(BASE + "/{id}/roles", localId).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("roles", List.of("DECANO")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.direct[*].name").value(org.hamcrest.Matchers.contains("DECANO")))
                .andExpect(jsonPath("$.effective[*].name").value(org.hamcrest.Matchers.hasItem("DECANO")))
                .andExpect(jsonPath("$.effective[*].name").value(
                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("offline_access"))));

        assertThat(jdbcTemplate.queryForList("SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id "
                + "WHERE ur.user_id = ?", String.class, localId)).containsExactly("DECANO");

        mockMvc.perform(put(BASE + "/{id}/roles", localId).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("roles", List.of("DIRECTOR")))))
                .andExpect(status().isOk());
        mockMvc.perform(get(BASE + "/{id}/roles", localId).with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.direct[*].name").value(org.hamcrest.Matchers.contains("DIRECTOR")));
        assertThat(audit("USER_ROLES_REPLACED")).hasSize(2)
                .allSatisfy(row -> assertThat(row.get("outcome")).isEqualTo("SUCCESS"));

        mockMvc.perform(put(BASE + "/{id}/roles", localId).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("roles", List.of("NO_EXISTE")))))
                .andExpect(status().isNotFound());
        mockMvc.perform(put(BASE + "/{id}/roles", localId).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("roles", List.of("offline_access")))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("The last enabled SUPERADMIN can neither lose the role nor be disabled")
    void protectsTheLastSuperadmin() throws Exception {
        UUID onlyAdmin = createUser(unique("iam006-sa"));
        String onlyAdminKeycloakId = keycloakIdOf(onlyAdmin);
        makeOnlySuperadmin(onlyAdminKeycloakId);

        mockMvc.perform(put(BASE + "/{id}/roles", onlyAdmin).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("roles", List.of()))))
                .andExpect(status().isConflict());
        mockMvc.perform(patch(BASE + "/{id}", onlyAdmin).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("enabled", false))))
                .andExpect(status().isConflict());
        assertThat(identityMappings.listUserRealmRoles(onlyAdminKeycloakId, false))
                .extracting(role -> role.name()).contains("SUPERADMIN");

        UUID secondAdmin = createUser(unique("iam006-sa2"));
        mockMvc.perform(put(BASE + "/{id}/roles", secondAdmin).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("roles", List.of("SUPERADMIN")))))
                .andExpect(status().isOk());
        mockMvc.perform(put(BASE + "/{id}/roles", onlyAdmin).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("roles", List.of()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.direct").isEmpty());
    }

    // ---- GET/PUT /admin/iam/users/{id}/permissions -----------------------------------------------------------

    @Test
    @DisplayName("PUT permissions assigns dss-permissions client roles directly; GET shows direct and inherited")
    void replacesPermissions() throws Exception {
        UUID localId = createUser(unique("iam006-perms"));
        mockMvc.perform(put(BASE + "/{id}/roles", localId).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("roles", List.of("DIRECTOR"))))).andExpect(status().isOk());

        mockMvc.perform(put(BASE + "/{id}/permissions", localId).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("permissions", List.of("dw:closure:read", "olap:user")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.direct[*].name").value(
                        org.hamcrest.Matchers.contains("dw:closure:read", "olap:user")));

        mockMvc.perform(get(BASE + "/{id}/permissions", localId).with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.effective[*].name").value(org.hamcrest.Matchers.hasItems(
                        "dw:closure:read", "olap:user", "analytics:read", "analytics:career")));

        mockMvc.perform(put(BASE + "/{id}/permissions", localId).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("permissions", List.of()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.direct").isEmpty());
        mockMvc.perform(put(BASE + "/{id}/permissions", localId).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("permissions", List.of("no:existe")))))
                .andExpect(status().isNotFound());

        assertThat(audit("USER_PERMISSIONS_REPLACED")).extracting(row -> row.get("outcome"))
                .containsExactly("SUCCESS", "SUCCESS", "FAILURE");
    }

    @Test
    @DisplayName("Responses never expose the Keycloak id")
    void doesNotExposeIdentityProviderIds() throws Exception {
        UUID localId = createUser(unique("iam006-ids"));
        String keycloakId = keycloakIdOf(localId);

        String response = mockMvc.perform(patch(BASE + "/{id}", localId).with(admin())
                        .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("lastName", "Otro"))))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Location"))
                .andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain(keycloakId);
    }
}
