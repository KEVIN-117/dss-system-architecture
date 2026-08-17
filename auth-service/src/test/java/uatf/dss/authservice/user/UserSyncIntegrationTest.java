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

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static final String VALID_SECRET = "dss-webhook-secret-xyz123";

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE users CASCADE");
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

        mockMvc.perform(post("/auth/sync")
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

        mockMvc.perform(post("/auth/sync")
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
    public void shouldRejectSyncRequestWithUnauthorizedWhenNoTokenProvided() throws Exception {
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

        mockMvc.perform(post("/auth/sync")
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonPayload))
                .andExpect(status().isUnauthorized());
        
        Optional<User> savedUserOpt = userRepository.findByKeycloakId(keycloakId);
        assertFalse(savedUserOpt.isPresent());
    }
}
