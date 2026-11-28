package uatf.dss.authservice.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import uatf.dss.authservice.TestcontainersConfiguration;
import uatf.dss.authservice.application.port.in.GetAuthUserProfileCommand;
import uatf.dss.authservice.application.port.in.GetAuthUserProfileUseCase;
import uatf.dss.authservice.application.port.in.GetUserAcademicScopeCommand;
import uatf.dss.authservice.application.port.in.GetUserAcademicScopeUseCase;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsCommand;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsCommand.AcademicContextInput;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsUseCase;
import uatf.dss.authservice.application.port.in.UserAcademicScope;
import uatf.dss.authservice.application.port.out.IdentityRoleMappingPort;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.exception.validation.InvalidAcademicContextException;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.UserAcademicContext;
import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.audit.AuditActor;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * IAM-009 end to end on PostgreSQL: a user holds several academic contexts, the read endpoints' use cases
 * ({@code /auth/me} and {@code /internal/users/{kcId}/academic-contexts}) return all of them, and the database
 * rejects duplicates (V8).
 */
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@DisplayName("Multiple academic contexts per user (IAM-009, PostgreSQL)")
class MultipleAcademicContextsIntegrationTest {

    private static final AuditActor ADMIN = new AuditActor("kc-admin", "ana.admin", "203.0.113.9");

    @Autowired private SetUserAcademicContextsUseCase setContexts;
    @Autowired private GetUserAcademicScopeUseCase academicScope;
    @Autowired private GetAuthUserProfileUseCase profile;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    // The academic scope is read live from Keycloak; here the permissions of each user are stubbed.
    @MockitoBean private IdentityRoleMappingPort identityMappings;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE admin_audit_log");
        jdbcTemplate.execute("TRUNCATE TABLE user_academic_contexts, user_roles, users CASCADE");
        jdbcTemplate.execute("TRUNCATE TABLE academic_programs, academic_faculties CASCADE");
        jdbcTemplate.update("INSERT INTO academic_faculties (faculty_id, name) VALUES "
                + "(5, 'Faculty 5'), (8, 'Faculty 8'), (10, 'Faculty 10')");
        jdbcTemplate.update("INSERT INTO academic_programs (career_id, faculty_id, name) VALUES "
                + "('025', 10, 'Program 25'), ('015', 8, 'Program 15')");
    }

    private User userWithRole(String username, String role) {
        User user = userRepository.save(User.create(null, UUID.randomUUID(), username, username + "@uatf.edu.bo",
                "Test", "User", true));
        userRepository.replaceRoleSnapshot(user.id(), Set.of(role));
        String permission = "DECANO".equals(role) ? "analytics:faculty" : "analytics:career";
        when(identityMappings.listUserClientRoles(user.keycloakId().toString(), "dss-permissions", true))
                .thenReturn(List.of(new IdentityRole(UUID.randomUUID().toString(), permission, null, false, false,
                        Map.of())));
        return user;
    }

    private static List<Integer> faculties(UserAcademicScope scope) {
        return scope.contexts().stream().map(UserAcademicScope.Context::facultyId).toList();
    }

    @Test
    @DisplayName("An acting dean of two faculties gets both, and /auth/me and /internal return both")
    void deanOfTwoFacultiesSeesBothEverywhere() {
        User dean = userWithRole("decano.interino", "DECANO");

        setContexts.execute(new SetUserAcademicContextsCommand(ADMIN, dean.id(),
                List.of(new AcademicContextInput(5, null), new AcademicContextInput(8, null))));

        UserAcademicScope scope = academicScope.execute(new GetUserAcademicScopeCommand(dean.keycloakId()));
        assertThat(faculties(scope)).containsExactlyInAnyOrder(5, 8);
        assertThat(scope.contexts()).extracting(UserAcademicScope.Context::careerId).containsOnlyNulls();
        assertThat(profile.execute(new GetAuthUserProfileCommand(dean.keycloakId())).academicContexts())
                .extracting(UserAcademicContext::facultyId).containsExactlyInAnyOrder(5, 8);

        Map<String, Object> audit = jdbcTemplate.queryForMap(
                "SELECT outcome, after_state::text AS after FROM admin_audit_log WHERE target_id = ?",
                dean.id().toString());
        assertThat(audit.get("outcome")).isEqualTo("SUCCESS");
        assertThat((String) audit.get("after")).contains("\"facultyId\": 5").contains("\"facultyId\": 8");
    }

    @Test
    @DisplayName("A director can lead careers of different faculties")
    void directorOfTwoCareers() {
        User director = userWithRole("director.doble", "DIRECTOR");

        setContexts.execute(new SetUserAcademicContextsCommand(ADMIN, director.id(),
                List.of(new AcademicContextInput(10, "025"), new AcademicContextInput(8, "015"))));

        assertThat(academicScope.execute(new GetUserAcademicScopeCommand(director.keycloakId())).contexts())
                .containsExactlyInAnyOrder(new UserAcademicScope.Context(10, "025"),
                        new UserAcademicScope.Context(8, "015"));
    }

    @Test
    @DisplayName("Replacing keeps a context the user already had without tripping the unique constraint")
    void replacementCanKeepAnExistingContext() {
        User dean = userWithRole("decano.cambio", "DECANO");
        setContexts.execute(new SetUserAcademicContextsCommand(ADMIN, dean.id(),
                List.of(new AcademicContextInput(5, null), new AcademicContextInput(8, null))));

        setContexts.execute(new SetUserAcademicContextsCommand(ADMIN, dean.id(),
                List.of(new AcademicContextInput(8, null), new AcademicContextInput(10, null))));

        assertThat(faculties(academicScope.execute(new GetUserAcademicScopeCommand(dean.keycloakId()))))
                .containsExactlyInAnyOrder(8, 10);
    }

    @Test
    @DisplayName("Duplicates are rejected by the service and nothing changes")
    void duplicatesAreRejectedAndContextsStayUnchanged() {
        User dean = userWithRole("decano.dup", "DECANO");
        setContexts.execute(new SetUserAcademicContextsCommand(ADMIN, dean.id(),
                List.of(new AcademicContextInput(5, null))));

        assertThatThrownBy(() -> setContexts.execute(new SetUserAcademicContextsCommand(ADMIN, dean.id(),
                List.of(new AcademicContextInput(8, null), new AcademicContextInput(8, null)))))
                .isInstanceOf(InvalidAcademicContextException.class)
                .hasMessageContaining("Duplicate");

        assertThat(faculties(academicScope.execute(new GetUserAcademicScopeCommand(dean.keycloakId()))))
                .containsExactly(5);
    }

    @Test
    @DisplayName("V8: the database itself rejects a duplicate context, including faculty-only ones")
    void databaseRejectsDuplicateContexts() {
        User dean = userWithRole("decano.db", "DECANO");
        String insert = "INSERT INTO user_academic_contexts (user_id, faculty_id, career_id) VALUES (?, ?, ?)";
        jdbcTemplate.update(insert, dean.id(), 5, null);
        jdbcTemplate.update(insert, dean.id(), 10, "025");

        assertThatThrownBy(() -> jdbcTemplate.update(insert, dean.id(), 5, null))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbcTemplate.update(insert, dean.id(), 10, "025"))
                .isInstanceOf(DataIntegrityViolationException.class);
        // The same scope for another user is fine.
        User other = userWithRole("decano.otro", "DECANO");
        jdbcTemplate.update(insert, other.id(), 5, null);
    }
}
