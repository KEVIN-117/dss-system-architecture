package uatf.dss.authservice.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import uatf.dss.authservice.TestcontainersConfiguration;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.model.User;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
public class UserSyncIntegrationTest {

    private static final String CONTEXT_PATH = "/api/v1";
    private static final String WEBHOOK_PATH = CONTEXT_PATH + "/auth/sync";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static final String VALID_SECRET = "test-webhook-secret";
    private static final int LOCAL_ROLE_ID = 99001;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE users CASCADE");
        jdbcTemplate.update("DELETE FROM roles WHERE id = ?", LOCAL_ROLE_ID);
    }

    @Test
    public void shouldSyncNewUserAndPersistInPostgres() throws Exception {
        UUID keycloakId = UUID.randomUUID();
        
        String jsonPayload = """
        {
            "eventId": "%s",
            "realmId": "uatf-dss-realm",
            "eventType": "USER_CREATED",
            "timestamp": %d,
            "user": {
                "keycloakId": "%s",
                "username": "johndoe",
                "email": "john.doe@example.com",
                "firstName": "John",
                "lastName": "Doe",
                "isActive": true
            }
        }
        """.formatted(UUID.randomUUID().toString(), System.currentTimeMillis(), keycloakId.toString());

        mockMvc.perform(post(WEBHOOK_PATH).contextPath(CONTEXT_PATH).servletPath("/auth/sync")
                .header("X-Webhook-Secret", VALID_SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonPayload))
                .andExpect(status().isOk());

        Optional<User> savedUserOpt = userRepository.findByKeycloakId(keycloakId);
        assertTrue(savedUserOpt.isPresent());

        User savedUser = savedUserOpt.get();
        assertNotNull(savedUser.id());
        assertEquals(keycloakId, savedUser.keycloakId());
        assertEquals("johndoe", savedUser.username());
        assertEquals("john.doe@example.com", savedUser.email().email());
        assertEquals("John", savedUser.firstName());
        assertEquals("Doe", savedUser.lastName());
        assertTrue(savedUser.isActive());
    }

    @Test
    public void shouldUpdateExistingUserInPostgresOnSubsequentSync() throws Exception {
        UUID keycloakId = UUID.randomUUID();
        
        User initialUser = User.create(
                null,
                keycloakId,
                "johndoe",
                "john.doe@example.com",
                "John",
                "Doe",
                true
        );
        User savedInitial = userRepository.save(initialUser);
        assertNotNull(savedInitial.id());

        String jsonPayload = """
        {
            "eventId": "%s",
            "realmId": "uatf-dss-realm",
            "eventType": "USER_UPDATED",
            "timestamp": %d,
            "user": {
                "keycloakId": "%s",
                "username": "johndoe.updated",
                "email": "john.doe.upd@example.com",
                "firstName": "John Upd",
                "lastName": "Doe Upd",
                "isActive": false
            }
        }
        """.formatted(UUID.randomUUID().toString(), System.currentTimeMillis(), keycloakId.toString());

        mockMvc.perform(post(WEBHOOK_PATH).contextPath(CONTEXT_PATH).servletPath("/auth/sync")
                .header("X-Webhook-Secret", VALID_SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonPayload))
                .andExpect(status().isOk());

        Optional<User> savedUserOpt = userRepository.findByKeycloakId(keycloakId);
        assertTrue(savedUserOpt.isPresent());

        User savedUser = savedUserOpt.get();
        assertEquals(savedInitial.id(), savedUser.id());
        assertEquals("johndoe.updated", savedUser.username());
        assertEquals("john.doe.upd@example.com", savedUser.email().email());
        assertEquals("John Upd", savedUser.firstName());
        assertEquals("Doe Upd", savedUser.lastName());
        assertFalse(savedUser.isActive());
    }

    @Test
    public void shouldUpdateProfileWithoutRemovingLocalRolesOrAcademicContexts() throws Exception {
        UUID keycloakId = UUID.randomUUID();
        User initialUser = User.create(
                null,
                keycloakId,
                "director.sistemas",
                "director.sistemas@uatf.edu.bo",
                "Director",
                "Sistemas",
                true
        );
        User savedInitial = userRepository.save(initialUser);
        UUID contextId = UUID.randomUUID();

        jdbcTemplate.update("INSERT INTO roles (id, name, description) VALUES (?, ?, ?)",
                LOCAL_ROLE_ID, "LOCAL_SYNC_TEST", "Role preserved during profile synchronization");
        jdbcTemplate.update("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)",
                savedInitial.id(), LOCAL_ROLE_ID);
        jdbcTemplate.update("INSERT INTO user_academic_contexts (id, user_id, faculty_id, career_id) VALUES (?, ?, ?, ?)",
                contextId, savedInitial.id(), 10, 25);

        String jsonPayload = """
        {
            "eventId": "%s",
            "realmId": "uatf-dss-realm",
            "eventType": "USER_UPDATED",
            "timestamp": %d,
            "user": {
                "keycloakId": "%s",
                "username": "director.sistemas.updated",
                "email": "director.updated@uatf.edu.bo",
                "firstName": "Director Updated",
                "lastName": "Sistemas Updated",
                "isActive": false
            }
        }
        """.formatted(UUID.randomUUID(), System.currentTimeMillis(), keycloakId);

        mockMvc.perform(post(WEBHOOK_PATH).contextPath(CONTEXT_PATH).servletPath("/auth/sync")
                .header("X-Webhook-Secret", VALID_SECRET)
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonPayload))
                .andExpect(status().isOk());

        User updatedUser = userRepository.findByKeycloakId(keycloakId).orElseThrow();
        assertEquals(savedInitial.id(), updatedUser.id());
        assertEquals("director.sistemas.updated", updatedUser.username());
        assertEquals("director.updated@uatf.edu.bo", updatedUser.email().email());
        assertEquals("Director Updated", updatedUser.firstName());
        assertEquals("Sistemas Updated", updatedUser.lastName());
        assertFalse(updatedUser.isActive());
        assertEquals(1L, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_roles WHERE user_id = ? AND role_id = ?",
                Long.class,
                savedInitial.id(),
                LOCAL_ROLE_ID));
        assertEquals(1L, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_academic_contexts " +
                        "WHERE id = ? AND user_id = ? AND faculty_id = ? AND career_id = ?",
                Long.class,
                contextId,
                savedInitial.id(),
                10,
                25));
    }

    @Test
    public void shouldRejectSyncRequestWithUnauthorizedWhenNoWebhookSecretProvided() throws Exception {
        UUID keycloakId = UUID.randomUUID();
        
        String jsonPayload = """
        {
            "eventId": "%s",
            "realmId": "uatf-dss-realm",
            "eventType": "USER_CREATED",
            "timestamp": %d,
            "user": {
                "keycloakId": "%s",
                "username": "johndoe",
                "email": "john.doe@example.com",
                "firstName": "John",
                "lastName": "Doe",
                "isActive": true
            }
        }
        """.formatted(UUID.randomUUID().toString(), System.currentTimeMillis(), keycloakId.toString());

        mockMvc.perform(post(WEBHOOK_PATH).contextPath(CONTEXT_PATH).servletPath("/auth/sync")
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonPayload))
                .andExpect(status().isUnauthorized());
        
        Optional<User> savedUserOpt = userRepository.findByKeycloakId(keycloakId);
        assertFalse(savedUserOpt.isPresent());
    }
}
