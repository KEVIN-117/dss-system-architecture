package uatf.dss.authservice.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import uatf.dss.authservice.TestcontainersConfiguration;
import uatf.dss.authservice.adapter.in.web.UserSyncController;
import uatf.dss.authservice.adapter.in.web.UserSyncRequest;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.model.User;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
public class UserSyncIntegrationTest {

    @Autowired
    private UserSyncController controller;

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
    public void shouldSyncNewUserAndPersistInPostgres() {
        UUID keycloakId = UUID.randomUUID();
        UserSyncRequest requestPayload = new UserSyncRequest(
                UUID.randomUUID().toString(),
                "uatf-dss-realm",
                "USER_CREATED",
                System.currentTimeMillis(),
                new UserSyncRequest.UserDto(
                        keycloakId,
                        "krodriguez.integ",
                        "krodriguez.integ@uatf.edu.bo",
                        "Kevin Integ",
                        "Rodriguez Integ",
                        true
                )
        );

        ResponseEntity<Void> response = controller.sync(VALID_SECRET, requestPayload);

        assertEquals(HttpStatus.OK, response.getStatusCode());

        Optional<User> savedUserOpt = userRepository.findByKeycloakId(keycloakId);
        assertTrue(savedUserOpt.isPresent());

        User savedUser = savedUserOpt.get();
        assertNotNull(savedUser.id());
        assertEquals(keycloakId, savedUser.keycloakId());
        assertEquals("krodriguez.integ", savedUser.username());
        assertEquals("krodriguez.integ@uatf.edu.bo", savedUser.email());
        assertEquals("Kevin Integ", savedUser.firstName());
        assertEquals("Rodriguez Integ", savedUser.lastName());
        assertTrue(savedUser.isActive());
    }

    @Test
    public void shouldUpdateExistingUserInPostgresOnSubsequentSync() {
        UUID keycloakId = UUID.randomUUID();
        
        User initialUser = new User(
                null,
                keycloakId,
                "krodriguez.integ",
                "krodriguez.integ@uatf.edu.bo",
                "Kevin Integ",
                "Rodriguez Integ",
                true
        );
        User savedInitial = userRepository.save(initialUser);
        assertNotNull(savedInitial.id());

        UserSyncRequest updatePayload = new UserSyncRequest(
                UUID.randomUUID().toString(),
                "uatf-dss-realm",
                "USER_UPDATED",
                System.currentTimeMillis(),
                new UserSyncRequest.UserDto(
                        keycloakId,
                        "krodriguez.integ.updated",
                        "krodriguez.integ.upd@uatf.edu.bo",
                        "Kevin Integ Upd",
                        "Rodriguez Integ Upd",
                        false
                )
        );

        ResponseEntity<Void> response = controller.sync(VALID_SECRET, updatePayload);
        assertEquals(HttpStatus.OK, response.getStatusCode());

        Optional<User> savedUserOpt = userRepository.findByKeycloakId(keycloakId);
        assertTrue(savedUserOpt.isPresent());

        User savedUser = savedUserOpt.get();
        assertEquals(savedInitial.id(), savedUser.id());
        assertEquals("krodriguez.integ.updated", savedUser.username());
        assertEquals("krodriguez.integ.upd@uatf.edu.bo", savedUser.email());
        assertEquals("Kevin Integ Upd", savedUser.firstName());
        assertEquals("Rodriguez Integ Upd", savedUser.lastName());
        assertFalse(savedUser.isActive());
    }

    @Test
    public void shouldRejectSyncRequestWithUnauthorizedWhenNoTokenProvided() {
        UUID keycloakId = UUID.randomUUID();
        UserSyncRequest requestPayload = new UserSyncRequest(
                UUID.randomUUID().toString(),
                "uatf-dss-realm",
                "USER_CREATED",
                System.currentTimeMillis(),
                new UserSyncRequest.UserDto(
                        keycloakId,
                        "krodriguez.integ",
                        "krodriguez.integ@uatf.edu.bo",
                        "Kevin",
                        "Rodriguez",
                        true
                )
        );

        ResponseEntity<Void> response = controller.sync(null, requestPayload);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        
        Optional<User> savedUserOpt = userRepository.findByKeycloakId(keycloakId);
        assertFalse(savedUserOpt.isPresent());
    }
}
