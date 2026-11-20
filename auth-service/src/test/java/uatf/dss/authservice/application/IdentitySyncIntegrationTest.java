package uatf.dss.authservice.application;

import org.junit.jupiter.api.AfterEach;
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
import org.springframework.web.client.RestClient;
import org.testcontainers.junit.jupiter.Testcontainers;
import uatf.dss.authservice.KeycloakTestRealm;
import uatf.dss.authservice.TestcontainersConfiguration;
import uatf.dss.authservice.application.port.in.IdentitySyncUseCase;
import uatf.dss.authservice.application.port.in.IdentitySyncUseCase.RoleChangeNotice;
import uatf.dss.authservice.application.port.out.IdentityRoleAdminPort;
import uatf.dss.authservice.application.port.out.IdentityRoleMappingPort;
import uatf.dss.authservice.application.port.out.IdentityUserAdminPort;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.identity.IdentityRoleDraft;
import uatf.dss.authservice.domain.model.identity.NewIdentityUser;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * IAM-010 against a real Keycloak and PostgreSQL: effective roles in the local snapshot, resynchronization after a
 * composite change or a role deletion, logical deletion of users and the full resynchronization endpoint.
 */
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DisplayName("Identity resynchronization (IAM-010, Keycloak + PostgreSQL)")
class IdentitySyncIntegrationTest {

    @DynamicPropertySource
    static void keycloak(DynamicPropertyRegistry registry) {
        registry.add("app.keycloak.admin.base-url", KeycloakTestRealm::baseUrl);
        registry.add("app.keycloak.admin.realm", () -> KeycloakTestRealm.REALM);
        registry.add("app.keycloak.admin.client-id", () -> KeycloakTestRealm.AUTH_SERVICE_CLIENT_ID);
        registry.add("app.keycloak.admin.client-secret", () -> KeycloakTestRealm.AUTH_SERVICE_SECRET);
    }

    @Autowired private IdentitySyncUseCase identitySync;
    @Autowired private IdentityUserAdminPort identityUsers;
    @Autowired private IdentityRoleAdminPort identityRoles;
    @Autowired private IdentityRoleMappingPort identityMappings;
    @Autowired private UserRepository localUsers;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private MockMvc mockMvc;

    private static final uatf.dss.authservice.domain.model.audit.AuditActor SYSTEM =
            new uatf.dss.authservice.domain.model.audit.AuditActor("kc-test", "sync.test", "127.0.0.1");

    private final List<String> createdUsers = new ArrayList<>();
    private final List<String> createdRoles = new ArrayList<>();
    private String parent;
    private String child;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE admin_audit_log");
        jdbcTemplate.execute("TRUNCATE TABLE user_academic_contexts, user_roles, users CASCADE");
        String suffix = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        parent = "SYNC_PARENT_" + suffix;
        child = "SYNC_CHILD_" + suffix;
        createRole(parent);
        createRole(child);
    }

    @AfterEach
    void cleanUp() {
        createdUsers.forEach(id -> {
            try { identityUsers.deleteUser(id); } catch (RuntimeException ignored) { }
        });
        createdRoles.forEach(name -> {
            try { identityRoles.deleteRealmRole(name); } catch (RuntimeException ignored) { }
        });
    }

    private void createRole(String name) {
        identityRoles.createRealmRole(new IdentityRoleDraft(name, "IAM-010 test", Map.of()));
        createdRoles.add(name);
    }

    private String createKeycloakUser(String prefix) {
        String username = prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
        String id = identityUsers.createUser(new NewIdentityUser(username, username + "@uatf.edu.bo", "Sync", "Test",
                true, true));
        createdUsers.add(id);
        return id;
    }

    /** Realm-role composite: the service account manages only client composites, so the master admin sets it up. */
    private void addRealmComposite(String role, String composite) {
        IdentityRole compositeRole = identityRoles.findRealmRole(composite).orElseThrow();
        RestClient.create(KeycloakTestRealm.baseUrl()).post()
                .uri("/admin/realms/{realm}/roles/{role}/composites", KeycloakTestRealm.REALM, role)
                .header("Authorization", "Bearer " + KeycloakTestRealm.masterAdminToken())
                .contentType(MediaType.APPLICATION_JSON)
                .body(List.of(Map.of("id", compositeRole.id(), "name", composite)))
                .retrieve().toBodilessEntity();
    }

    private List<String> localRoles(String keycloakId) {
        User user = localUsers.findByKeycloakId(UUID.fromString(keycloakId)).orElseThrow();
        return localUsers.findRoleNamesByUserId(user.id());
    }

    @Test
    @DisplayName("A composite change reaches every holder's local snapshot, and a deleted role leaves it")
    void compositeChangesAndRoleDeletionsReachTheLocalSnapshot() {
        String ana = createKeycloakUser("ana");
        identityMappings.addUserRealmRoles(ana, Set.of(parent));
        identitySync.resyncAll(SYSTEM);
        assertThat(localRoles(ana)).contains(parent).doesNotContain(child);

        addRealmComposite(parent, child);
        int resynced = identitySync.resyncAfterRoleChange(
                new RoleChangeNotice(parent, false, null, RoleChangeNotice.Change.COMPOSITES_ADDED, true));

        assertThat(resynced).isEqualTo(1);
        assertThat(localRoles(ana)).as("effective roles, like the token").contains(parent, child);

        identityRoles.deleteRealmRole(child);
        // Deleted by id in the console: the event carries no name.
        identitySync.resyncAfterRoleChange(new RoleChangeNotice(null, false, null, RoleChangeNotice.Change.DELETED, true));

        assertThat(localRoles(ana)).contains(parent).doesNotContain(child);
    }

    @Test
    @DisplayName("A deleted user is anonymized and hidden, and its username can be reused")
    void deletedUsersAreLogicallyDeletedAndFreeTheirUsername() {
        String ana = createKeycloakUser("ana");
        identitySync.resyncAll(SYSTEM);
        User before = localUsers.findByKeycloakId(UUID.fromString(ana)).orElseThrow();
        jdbcTemplate.update("INSERT INTO academic_faculties (faculty_id, name) VALUES (77, 'Faculty 77') "
                + "ON CONFLICT (faculty_id) DO NOTHING");
        jdbcTemplate.update("INSERT INTO user_academic_contexts (user_id, faculty_id) VALUES (?, 77)", before.id());

        assertThat(identitySync.removeLocalUser(UUID.fromString(ana))).isTrue();
        assertThat(identitySync.removeLocalUser(UUID.fromString(ana))).as("already deleted").isFalse();

        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT username, email, first_name, is_active, deleted_at FROM users WHERE id = ?", before.id());
        assertThat(row.get("username")).isEqualTo("deleted-" + ana);
        assertThat((String) row.get("email")).endsWith("@deleted.invalid");
        assertThat(row.get("first_name")).isNull();
        assertThat(row.get("is_active")).isEqualTo(false);
        assertThat(row.get("deleted_at")).isNotNull();
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM user_academic_contexts WHERE user_id = ?",
                Integer.class, before.id())).isZero();
        assertThat(localUsers.searchDirectory(null, null, null, null, null, 0, 50).users())
                .extracting(User::id).doesNotContain(before.id());

        // A new Keycloak account with the same username and e-mail syncs without a unique-key conflict.
        localUsers.save(User.create(null, UUID.randomUUID(), before.username(), before.email().email(), "Nueva",
                "Cuenta", true));
    }

    @Test
    @DisplayName("POST /admin/iam/users/resync rebuilds the copy, removes orphans and is audited")
    void fullResyncEndpoint() throws Exception {
        String ana = createKeycloakUser("ana");
        identityMappings.addUserRealmRoles(ana, Set.of(parent));
        UUID orphan = UUID.randomUUID();
        localUsers.save(User.create(null, orphan, "huerfano-" + orphan.toString().substring(0, 8),
                "huerfano@uatf.edu.bo", "Sin", "Keycloak", true));

        mockMvc.perform(post("/admin/iam/users/resync")
                        .with(jwt().jwt(token -> token.subject(UUID.randomUUID().toString())
                                        .claim("preferred_username", "ana.admin"))
                                .authorities(new SimpleGrantedAuthority("iam:users:write"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removed").value(1))
                .andExpect(jsonPath("$.scanned").isNumber());

        assertThat(localRoles(ana)).contains(parent);
        assertThat(jdbcTemplate.queryForObject("SELECT deleted_at IS NOT NULL FROM users WHERE keycloak_id = ?",
                Boolean.class, orphan)).isTrue();
        Map<String, Object> audit = jdbcTemplate.queryForMap(
                "SELECT outcome, actor_username, after_state::text AS after FROM admin_audit_log WHERE action = 'USERS_RESYNCED'");
        assertThat(audit.get("outcome")).isEqualTo("SUCCESS");
        assertThat(audit.get("actor_username")).isEqualTo("ana.admin");
        assertThat((String) audit.get("after")).contains("\"removed\": 1");

        mockMvc.perform(post("/admin/iam/users/resync")
                        .with(jwt().authorities(new SimpleGrantedAuthority("iam:users:read"))))
                .andExpect(status().isForbidden());
    }
}
