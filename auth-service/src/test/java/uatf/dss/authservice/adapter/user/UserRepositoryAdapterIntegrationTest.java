package uatf.dss.authservice.adapter.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import uatf.dss.authservice.TestcontainersConfiguration;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.model.User;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@DisplayName("UserRepositoryAdapter Integration Tests")
public class UserRepositoryAdapterIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE user_academic_contexts, user_roles, users CASCADE");
    }

    @Test
    @DisplayName("Should save a new user and find it by id")
    void shouldSaveAndFindUserById() {
        UUID keycloakId = UUID.randomUUID();
        User user = User.create(
                null,
                keycloakId,
                "krodriguez",
                "krodriguez@uatf.edu.bo",
                "Kevin",
                "Rodriguez",
                true
        );

        User savedUser = userRepository.save(user);

        assertNotNull(savedUser.id(), "Saved user should have an auto-generated id");
        assertEquals(keycloakId, savedUser.keycloakId());
        assertEquals("krodriguez", savedUser.username());
        assertEquals("krodriguez@uatf.edu.bo", savedUser.email().email());
        assertEquals("Kevin", savedUser.firstName());
        assertEquals("Rodriguez", savedUser.lastName());
        assertTrue(savedUser.isActive());

        Optional<User> foundOpt = userRepository.findById(savedUser.id());
        assertTrue(foundOpt.isPresent(), "User should be found by primary key ID");
        assertEquals("krodriguez", foundOpt.get().username());
    }

    @Test
    @DisplayName("Should find user by Keycloak ID")
    void shouldFindByKeycloakId() {
        UUID keycloakId = UUID.randomUUID();
        User user = User.create(
                null,
                keycloakId,
                "docente.ing",
                "docente.ing@uatf.edu.bo",
                "Docente",
                "Ingenieria",
                true
        );
        userRepository.save(user);

        Optional<User> foundOpt = userRepository.findByKeycloakId(keycloakId);
        assertTrue(foundOpt.isPresent(), "User should be found by Keycloak ID");
        assertEquals("docente.ing", foundOpt.get().username());
        assertEquals("docente.ing@uatf.edu.bo", foundOpt.get().email().email());
    }

    @Test
    @DisplayName("Should find user by email")
    void shouldFindByEmail() {
        User user = User.create(
                null,
                UUID.randomUUID(),
                "rector.uatf",
                "rector@uatf.edu.bo",
                "Rector",
                "UATF",
                true
        );
        userRepository.save(user);

        Optional<User> foundOpt = userRepository.findByEmail("rector@uatf.edu.bo");
        assertTrue(foundOpt.isPresent(), "User should be found by Email");
        assertEquals("rector.uatf", foundOpt.get().username());
    }

    @Test
    @DisplayName("Should verify existsByEmail returns correct boolean")
    void shouldCheckExistsByEmail() {
        User user = User.create(
                null,
                UUID.randomUUID(),
                "decano.fac",
                "decano.ciencias@uatf.edu.bo",
                "Decano",
                "Puras",
                true
        );
        userRepository.save(user);

        assertTrue(userRepository.existsByEmail("decano.ciencias@uatf.edu.bo"));
        assertFalse(userRepository.existsByEmail("inexistente@uatf.edu.bo"));
    }

    @Test
    @DisplayName("Should return a stable paged directory filtered by profile, role and academic context")
    void shouldSearchAdminDirectoryWithFiltersAndPagination() {
        User matching = userRepository.save(User.create(null, UUID.randomUUID(), "directory.match", "match@uatf.edu.bo",
                "Ana", "Flores", true));
        User wrongContext = userRepository.save(User.create(null, UUID.randomUUID(), "directory.other", "other@uatf.edu.bo",
                "Ana", "Flores", true));
        userRepository.save(User.create(null, UUID.randomUUID(), "directory.inactive", "inactive@uatf.edu.bo",
                "Ana", "Flores", false));
        jdbcTemplate.update("INSERT INTO roles (id, name, description) VALUES (900, 'DIRECTORY_TEST_ROLE', 'directory test') ON CONFLICT (id) DO NOTHING");
        jdbcTemplate.update("INSERT INTO academic_faculties (faculty_id, name) VALUES (4, 'Directory Faculty 4'), (5, 'Directory Faculty 5') ON CONFLICT (faculty_id) DO NOTHING");
        jdbcTemplate.update("INSERT INTO academic_programs (career_id, faculty_id, name) VALUES ('INF', 4, 'Directory Informatics'), ('MED', 5, 'Directory Medicine') ON CONFLICT (career_id) DO NOTHING");
        jdbcTemplate.update("INSERT INTO user_roles (user_id, role_id) VALUES (?, 900), (?, 900)", matching.id(), wrongContext.id());
        jdbcTemplate.update("INSERT INTO user_academic_contexts (user_id, faculty_id, career_id) VALUES (?, 4, 'INF'), (?, 5, 'MED')",
                matching.id(), wrongContext.id());

        var page = userRepository.searchDirectory("DIRECTORY", true, "directory_test_role", 4, "INF", 0, 1);

        assertEquals(1, page.users().size());
        assertEquals(matching.id(), page.users().getFirst().id());
        assertEquals(1, page.totalElements());
        assertEquals(1, page.totalPages());
    }

    @Test
    @DisplayName("Should update existing user when saved with same ID")
    void shouldUpdateExistingUser() {
        User initial = User.create(
                null,
                UUID.randomUUID(),
                "director.sistemas",
                "dir.sistemas@uatf.edu.bo",
                "Director",
                "Sistemas",
                true
        );
        User savedInitial = userRepository.save(initial);

        User updated = User.create(
                savedInitial.id(),
                savedInitial.keycloakId(),
                "director.sistemas.updated",
                "dir.sistemas.upd@uatf.edu.bo",
                "Director Updated",
                "Sistemas Updated",
                false
        );
        User savedUpdated = userRepository.save(updated);

        assertEquals(savedInitial.id(), savedUpdated.id());
        assertEquals("director.sistemas.updated", savedUpdated.username());
        assertEquals("dir.sistemas.upd@uatf.edu.bo", savedUpdated.email().email());
        assertEquals("Director Updated", savedUpdated.firstName());
        assertFalse(savedUpdated.isActive());
    }

    @Test
    @DisplayName("Should soft delete user by setting isActive to false")
    void shouldSoftDeleteUser() {
        User user = User.create(
                null,
                UUID.randomUUID(),
                "usuario.baja",
                "usuario.baja@uatf.edu.bo",
                "Usuario",
                "Baja",
                true
        );
        User savedUser = userRepository.save(user);
        assertTrue(savedUser.isActive());

        userRepository.delete(savedUser.id());

        Optional<User> foundOpt = userRepository.findById(savedUser.id());
        assertTrue(foundOpt.isPresent(), "Soft-deleted user should still exist in database");
        assertFalse(foundOpt.get().isActive(), "User isActive flag should be false after soft delete");
    }

    @Test
    @DisplayName("Should throw UserNotFoundException when attempting to delete non-existent user")
    void shouldThrowNotFoundExceptionWhenDeletingNonExistentUser() {
        UUID nonExistentId = UUID.randomUUID();
        assertThrows(UserNotFoundException.class, () -> userRepository.delete(nonExistentId));
    }
}
