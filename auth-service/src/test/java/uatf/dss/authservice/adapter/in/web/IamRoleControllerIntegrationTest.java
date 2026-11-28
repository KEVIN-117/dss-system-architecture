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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.json.JsonMapper;
import uatf.dss.authservice.KeycloakTestRealm;
import uatf.dss.authservice.TestcontainersConfiguration;
import uatf.dss.authservice.application.port.out.IdentityRoleAdminPort;
import uatf.dss.authservice.application.port.out.IdentityRoleMappingPort;
import uatf.dss.authservice.application.port.out.IdentityUserAdminPort;
import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.identity.NewIdentityUser;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * {@code /admin/iam/roles} and {@code /admin/iam/permissions} over HTTP against a real Keycloak (repository realm,
 * IAM-001 service account) and PostgreSQL: Keycloak state, audit rows, protection rules and the token that users
 * receive afterwards.
 */
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DisplayName("IAM roles and permissions API (Keycloak + PostgreSQL)")
class IamRoleControllerIntegrationTest {

    private static final String ROLES = "/admin/iam/roles";
    private static final String PERMISSIONS = "/admin/iam/permissions";
    private static final String CATALOG = "dss-permissions";

    @DynamicPropertySource
    static void keycloak(DynamicPropertyRegistry registry) {
        registry.add("app.keycloak.admin.base-url", KeycloakTestRealm::baseUrl);
        registry.add("app.keycloak.admin.realm", () -> KeycloakTestRealm.REALM);
        registry.add("app.keycloak.admin.client-id", () -> KeycloakTestRealm.AUTH_SERVICE_CLIENT_ID);
        registry.add("app.keycloak.admin.client-secret", () -> KeycloakTestRealm.AUTH_SERVICE_SECRET);
    }

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private JsonMapper jsonMapper;
    @Autowired private IdentityRoleAdminPort identityRoles;
    @Autowired private IdentityRoleMappingPort identityMappings;
    @Autowired private IdentityUserAdminPort identityUsers;

    @BeforeEach
    void cleanAudit() {
        jdbcTemplate.execute("TRUNCATE TABLE admin_audit_log");
    }

    private static RequestPostProcessor admin() {
        return jwt().jwt(token -> token.subject(UUID.randomUUID().toString()).claim("preferred_username", "ana.admin"))
                .authorities(new SimpleGrantedAuthority("iam:roles:read"), new SimpleGrantedAuthority("iam:roles:write"));
    }

    private static String suffix() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    private static String roleName() {
        return "IAM007_" + suffix().toUpperCase(Locale.ROOT);
    }

    private static String permissionName() {
        return "it" + suffix() + ":export";
    }

    private String body(Object value) {
        return jsonMapper.writeValueAsString(value);
    }

    private void createRole(String name) throws Exception {
        mockMvc.perform(post(ROLES).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("name", name, "description", "Rol de prueba", "portal", "director"))))
                .andExpect(status().isCreated());
    }

    private void createPermission(String name) throws Exception {
        mockMvc.perform(post(PERMISSIONS).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("name", name, "description", "Permiso de prueba"))))
                .andExpect(status().isCreated());
    }

    private List<String> portalPermissionsOf(String role) {
        return identityRoles.listRealmRoleClientComposites(role, CATALOG).stream().map(IdentityRole::name)
                .filter(name -> name.startsWith("portal:")).sorted().toList();
    }

    private List<String> auditOutcomes(String action) {
        return jdbcTemplate.queryForList("SELECT outcome FROM admin_audit_log WHERE action = ? ORDER BY occurred_at",
                String.class, action);
    }

    // ---- roles ---------------------------------------------------------------------------------------------

    @Test
    @DisplayName("Creates, reads, updates and deletes a role, auditing each write")
    void roleLifecycle() throws Exception {
        String name = roleName();

        mockMvc.perform(post(ROLES).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("name", name, "description", "Coordinación académica", "portal", "director"))))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/admin/iam/roles/" + name))
                .andExpect(jsonPath("$.portal").value("director"))
                .andExpect(jsonPath("$.system").value(false));
        assertThat(portalPermissionsOf(name)).as("the application is the portal:* composite").containsExactly("portal:director");
        assertThat(identityRoles.findRealmRole(name)).get()
                .satisfies(role -> assertThat(role.attributes()).doesNotContainKey("portal"));

        mockMvc.perform(get(ROLES).with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name").value(hasItem(name)))
                .andExpect(jsonPath("$[*].name").value(not(hasItem("offline_access"))))
                .andExpect(jsonPath("$[?(@.name == 'SUPERADMIN')].system").value(contains(true)));

        mockMvc.perform(patch(ROLES + "/{name}", name).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("description", "Nueva descripción", "portal", "decano"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Nueva descripción"))
                .andExpect(jsonPath("$.portal").value("decano"));
        assertThat(portalPermissionsOf(name)).as("exactly one application").containsExactly("portal:decano");
        mockMvc.perform(patch(ROLES + "/{name}", name).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("portal", ""))))
                .andExpect(status().isBadRequest());
        assertThat(portalPermissionsOf(name)).containsExactly("portal:decano");

        mockMvc.perform(delete(ROLES + "/{name}", name).with(admin())).andExpect(status().isNoContent());
        mockMvc.perform(get(ROLES + "/{name}", name).with(admin())).andExpect(status().isNotFound());

        assertThat(auditOutcomes("ROLE_CREATED")).containsExactly("SUCCESS");
        assertThat(auditOutcomes("ROLE_UPDATED")).containsExactly("SUCCESS", "FAILURE");
        assertThat(auditOutcomes("ROLE_DELETED")).containsExactly("SUCCESS");
    }

    @Test
    @DisplayName("Rejects invalid and duplicate roles")
    void rejectsInvalidAndDuplicateRoles() throws Exception {
        String name = roleName();
        createRole(name);

        mockMvc.perform(post(ROLES).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("name", name, "portal", "director")))).andExpect(status().isConflict());
        mockMvc.perform(post(ROLES).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("name", "minusculas", "portal", "director")))).andExpect(status().isBadRequest());
        mockMvc.perform(post(ROLES).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("name", roleName(), "portal", "becas")))).andExpect(status().isBadRequest());
        String withoutApplication = roleName();
        mockMvc.perform(post(ROLES).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("name", withoutApplication))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("admin, rector, decano, director")));
        assertThat(identityRoles.findRealmRole(withoutApplication)).isEmpty();
        assertThat(auditOutcomes("ROLE_CREATED")).containsExactly("SUCCESS", "FAILURE", "FAILURE", "FAILURE", "FAILURE");
    }

    @Test
    @DisplayName("System roles open exactly their application and keep it")
    void systemRolesKeepTheirApplication() throws Exception {
        mockMvc.perform(get(ROLES).with(admin()))
                .andExpect(jsonPath("$[?(@.name == 'SUPERADMIN')].portal").value(contains("admin")))
                .andExpect(jsonPath("$[?(@.name == 'RECTOR')].portal").value(contains("rector")))
                .andExpect(jsonPath("$[?(@.name == 'DECANO')].portal").value(contains("decano")))
                .andExpect(jsonPath("$[?(@.name == 'DIRECTOR')].portal").value(contains("director")));

        mockMvc.perform(patch(ROLES + "/RECTOR").with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("portal", "admin"))))
                .andExpect(status().isConflict());
        assertThat(portalPermissionsOf("RECTOR")).containsExactly("portal:rector");
    }

    @Test
    @DisplayName("System roles are never deleted; roles with users need force=true")
    void protectsSystemRolesAndRolesInUse() throws Exception {
        mockMvc.perform(delete(ROLES + "/DECANO").param("force", "true").with(admin())).andExpect(status().isConflict());
        assertThat(identityRoles.findRealmRole("DECANO")).isPresent();

        String name = roleName();
        createRole(name);
        String userId = identityUsers.createUser(new NewIdentityUser("iam007-" + suffix(), null, null, null, true, false));
        identityMappings.addUserRealmRoles(userId, Set.of(name));

        mockMvc.perform(delete(ROLES + "/{name}", name).with(admin()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("force=true")));
        mockMvc.perform(delete(ROLES + "/{name}", name).param("force", "true").with(admin()))
                .andExpect(status().isNoContent());
        assertThat(identityMappings.listUserRealmRoles(userId, false)).extracting(IdentityRole::name).doesNotContain(name);
    }

    // ---- role ↔ permissions --------------------------------------------------------------------------------

    @Test
    @DisplayName("PUT role permissions changes the composites; SUPERADMIN keeps iam:*")
    void replacesRolePermissions() throws Exception {
        String role = roleName();
        createRole(role);

        mockMvc.perform(put(ROLES + "/{name}/permissions", role).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("permissions", List.of("analytics:read", "olap:user")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name").value(contains("analytics:read", "olap:user", "portal:director")))
                .andExpect(jsonPath("$[0].resource").value("analytics"))
                .andExpect(jsonPath("$[0].action").value("read"));
        mockMvc.perform(put(ROLES + "/{name}/permissions", role).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("permissions", List.of("olap:user")))))
                .andExpect(status().isOk());
        mockMvc.perform(get(ROLES + "/{name}/permissions", role).with(admin()))
                .andExpect(jsonPath("$[*].name").value(contains("olap:user", "portal:director")));
        mockMvc.perform(put(ROLES + "/{name}/permissions", role).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("permissions", List.of("no:existe")))))
                .andExpect(status().isNotFound());
        mockMvc.perform(put(ROLES + "/{name}/permissions", role).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("permissions", List.of("olap:user", "portal:admin")))))
                .andExpect(status().isBadRequest());
        assertThat(portalPermissionsOf(role)).containsExactly("portal:director");

        mockMvc.perform(put(ROLES + "/SUPERADMIN/permissions").with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("permissions", List.of("connectors:read")))))
                .andExpect(status().isConflict());
        assertThat(identityRoles.listRealmRoleClientComposites("SUPERADMIN", CATALOG)).extracting(IdentityRole::name)
                .contains("iam:roles:write", "iam:users:write");

        assertThat(auditOutcomes("ROLE_PERMISSIONS_REPLACED"))
                .containsExactly("SUCCESS", "SUCCESS", "FAILURE", "FAILURE", "FAILURE");
    }

    // ---- permissions ---------------------------------------------------------------------------------------

    @Test
    @DisplayName("Creates, lists, updates and deletes a permission; validates resource:action and uniqueness")
    void permissionLifecycle() throws Exception {
        String name = permissionName();

        mockMvc.perform(post(PERMISSIONS).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("name", name, "description", "Exportar reportes"))))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/admin/iam/permissions/" + name))
                .andExpect(jsonPath("$.action").value("export"))
                .andExpect(jsonPath("$.system").value(false));
        mockMvc.perform(post(PERMISSIONS).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("name", name, "description", "otra")))).andExpect(status().isConflict());
        mockMvc.perform(post(PERMISSIONS).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("name", "SinFormato", "description", "x")))).andExpect(status().isBadRequest());
        mockMvc.perform(post(PERMISSIONS).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("name", "portal:becas", "description", "Portal de becas")))).andExpect(status().isBadRequest());

        mockMvc.perform(get(PERMISSIONS).with(admin()))
                .andExpect(jsonPath("$[*].name").value(hasItem(name)))
                .andExpect(jsonPath("$[?(@.name == 'iam:users:write')].system").value(contains(true)));

        mockMvc.perform(patch(PERMISSIONS + "/{name}", name).with(admin()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("description", "Exportar reportes en PDF"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Exportar reportes en PDF"));

        mockMvc.perform(delete(PERMISSIONS + "/{name}", name).with(admin())).andExpect(status().isNoContent());
        assertThat(identityRoles.findClientRole(CATALOG, name)).isEmpty();
        assertThat(auditOutcomes("PERMISSION_CREATED")).containsExactly("SUCCESS", "FAILURE", "FAILURE", "FAILURE");
        assertThat(auditOutcomes("PERMISSION_UPDATED")).containsExactly("SUCCESS");
        assertThat(auditOutcomes("PERMISSION_DELETED")).containsExactly("SUCCESS");
    }

    @Test
    @DisplayName("System permissions are never deleted; permissions in use need force=true")
    void protectsSystemPermissionsAndPermissionsInUse() throws Exception {
        mockMvc.perform(delete(PERMISSIONS + "/iam:users:write").param("force", "true").with(admin()))
                .andExpect(status().isConflict());
        mockMvc.perform(delete(PERMISSIONS + "/context:read").param("force", "true").with(admin()))
                .andExpect(status().isConflict());
        mockMvc.perform(delete(PERMISSIONS + "/portal:admin").param("force", "true").with(admin()))
                .andExpect(status().isConflict());

        String role = roleName();
        String permission = permissionName();
        createRole(role);
        createPermission(permission);
        mockMvc.perform(put(ROLES + "/{name}/permissions", role).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("permissions", List.of(permission))))).andExpect(status().isOk());

        mockMvc.perform(delete(PERMISSIONS + "/{name}", permission).with(admin()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString(role)));
        mockMvc.perform(delete(PERMISSIONS + "/{name}", permission).param("force", "true").with(admin()))
                .andExpect(status().isNoContent());
        assertThat(identityRoles.listRealmRoleClientComposites(role, CATALOG)).extracting(IdentityRole::name)
                .containsExactly("portal:director");
    }

    @Test
    @DisplayName("The matrix lists every role with the permissions it groups")
    void matrix() throws Exception {
        String role = roleName();
        createRole(role);
        mockMvc.perform(put(ROLES + "/{name}/permissions", role).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("permissions", List.of("olap:user"))))).andExpect(status().isOk());

        mockMvc.perform(get(PERMISSIONS + "/matrix").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles[*].name").value(hasItem(role)))
                .andExpect(jsonPath("$.permissions[*].name").value(hasItem("olap:user")))
                .andExpect(jsonPath("$.grants." + role).value(contains("olap:user", "portal:director")))
                .andExpect(jsonPath("$.roles[?(@.name == '" + role + "')].portal").value(contains("director")))
                .andExpect(jsonPath("$.grants.DECANO").value(org.hamcrest.Matchers.hasItems(
                        "analytics:read", "analytics:career", "analytics:faculty", "pipelines:read")));
    }

    @Test
    @DisplayName("Reads need iam:roles:read and writes iam:roles:write")
    void requiresPermissions() throws Exception {
        mockMvc.perform(get(ROLES).with(jwt().authorities(new SimpleGrantedAuthority("iam:users:read"))))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(PERMISSIONS).with(jwt().authorities(new SimpleGrantedAuthority("iam:roles:read")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("name", permissionName(), "description", "x"))))
                .andExpect(status().isForbidden());
    }

    // ---- acceptance: the next token ------------------------------------------------------------------------

    @Test
    @DisplayName("A permission created through the API appears in the next token of users holding the role")
    void newPermissionReachesTheNextToken() throws Exception {
        String role = roleName();
        String permission = permissionName();
        String userId = identityUsers.createUser(new NewIdentityUser("iam007-token-" + suffix(), null, null, null, true, false));
        createRole(role);
        identityMappings.addUserRealmRoles(userId, Set.of(role));
        assertThat(KeycloakTestRealm.clientRolesIn(KeycloakTestRealm.bffAccessTokenFor(userId), CATALOG))
                .doesNotContain(permission);

        createPermission(permission);
        mockMvc.perform(put(ROLES + "/{name}/permissions", role).with(admin()).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("permissions", List.of(permission))))).andExpect(status().isOk());

        assertThat(KeycloakTestRealm.clientRolesIn(KeycloakTestRealm.bffAccessTokenFor(userId), CATALOG))
                .contains(permission);
    }
}
