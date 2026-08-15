package uatf.dss.authservice.adapter.academiccontext;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import uatf.dss.authservice.TestcontainersConfiguration;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@DisplayName("UserAcademicContextAdapter Integration Tests")
public class UserAcademicContextAdapterIntegrationTest {

    @Autowired
    private AcademicContextRepository academicContextRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE user_academic_contexts, user_roles, users CASCADE");
    }

    private User createAndSaveTestUser(String username, String email) {
        User user = User.create(
                null,
                UUID.randomUUID(),
                username,
                email,
                "Test",
                "User",
                true
        );
        return userRepository.save(user);
    }

    @Test
    @DisplayName("Should save academic context and find by user ID")
    void shouldSaveAndFindByUserId() {
        User user = createAndSaveTestUser("director.carrera", "director.carrera@uatf.edu.bo");

        UserAcademicContext context = new UserAcademicContext(
                null,
                user.id(),
                10,
                25
        );

        UserAcademicContext savedContext = academicContextRepository.save(context);

        assertNotNull(savedContext.id(), "Context ID should be generated");
        assertEquals(user.id(), savedContext.userId());
        assertEquals(10, savedContext.facultyId());
        assertEquals(25, savedContext.careerId());

        Optional<UserAcademicContext> foundOpt = academicContextRepository.findByUserId(user.id());
        assertTrue(foundOpt.isPresent(), "Should find academic context by userId");
        assertEquals(savedContext.id(), foundOpt.get().id());
        assertEquals(user.id(), foundOpt.get().userId());
        assertEquals(10, foundOpt.get().facultyId());
        assertEquals(25, foundOpt.get().careerId());
    }

    @Test
    @DisplayName("Should save Dean academic context with faculty only")
    void shouldSaveDeanContextWithFacultyOnly() {
        User dean = createAndSaveTestUser("decano.ingenieria", "decano.ing@uatf.edu.bo");

        UserAcademicContext deanContext = new UserAcademicContext(
                null,
                dean.id(),
                5,
                null
        );

        UserAcademicContext saved = academicContextRepository.save(deanContext);
        assertNotNull(saved.id());
        assertEquals(5, saved.facultyId());
        assertNull(saved.careerId());

        Optional<UserAcademicContext> found = academicContextRepository.findByUserId(dean.id());
        assertTrue(found.isPresent());
        assertEquals(5, found.get().facultyId());
        assertNull(found.get().careerId());
    }

    @Test
    @DisplayName("Should save Rector academic context with null faculty and null career")
    void shouldSaveRectorContextWithNullFacultyAndCareer() {
        User rector = createAndSaveTestUser("rector.general", "rector.general@uatf.edu.bo");

        UserAcademicContext rectorContext = new UserAcademicContext(
                null,
                rector.id(),
                null,
                null
        );

        UserAcademicContext saved = academicContextRepository.save(rectorContext);
        assertNotNull(saved.id());
        assertNull(saved.facultyId());
        assertNull(saved.careerId());

        Optional<UserAcademicContext> found = academicContextRepository.findByUserId(rector.id());
        assertTrue(found.isPresent());
        assertNull(found.get().facultyId());
        assertNull(found.get().careerId());
    }

    @Test
    @DisplayName("Should delete academic context by id")
    void shouldDeleteAcademicContextById() {
        User user = createAndSaveTestUser("user.context.delete", "user.ctx.del@uatf.edu.bo");

        UserAcademicContext context = new UserAcademicContext(
                null,
                user.id(),
                8,
                15
        );
        UserAcademicContext saved = academicContextRepository.save(context);

        Optional<UserAcademicContext> deleted = academicContextRepository.delete(saved.id());
        assertTrue(deleted.isPresent(), "Delete should return the deleted domain entity");
        assertEquals(saved.id(), deleted.get().id());

        Optional<UserAcademicContext> foundAfterDelete = academicContextRepository.findByUserId(user.id());
        assertFalse(foundAfterDelete.isPresent(), "Context should no longer exist after deletion");
    }
}
