package uatf.dss.authservice.adapter.role;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import uatf.dss.authservice.TestcontainersConfiguration;
import uatf.dss.authservice.application.port.out.RoleRepository;
import uatf.dss.authservice.domain.model.Role;
import uatf.dss.authservice.domain.model.RoleType;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@DisplayName("RoleRepositoryAdapter Integration Tests")
public class RoleRepositoryAdapterIntegrationTest {

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("TRUNCATE TABLE user_roles, roles CASCADE");
        jdbcTemplate.execute("INSERT INTO roles (id, name, description) VALUES " +
                "(1, 'SUPERADMIN', 'Super Administrator role'), " +
                "(2, 'RECTOR', 'University Rector role'), " +
                "(3, 'DECANO', 'Faculty Dean role'), " +
                "(4, 'DIRECTOR', 'Program Director role')");
    }

    @Test
    @DisplayName("Should find role by name matching domain RoleType")
    void shouldFindRoleByName() {
        Optional<Role> roleOpt = roleRepository.findByName("SUPERADMIN");

        assertTrue(roleOpt.isPresent(), "Role SUPERADMIN should be found");
        Role role = roleOpt.get();
        assertEquals(1, role.id());
        assertEquals(RoleType.SUPERADMIN, role.name());
        assertEquals("Super Administrator role", role.description());
    }

    @Test
    @DisplayName("Should return empty optional when role name does not exist")
    void shouldReturnEmptyWhenRoleDoesNotExist() {
        Optional<Role> roleOpt = roleRepository.findByName("NON_EXISTENT_ROLE");

        assertFalse(roleOpt.isPresent(), "Non-existent role should return Optional.empty()");
    }

    @Test
    @DisplayName("Should list all roles successfully")
    void shouldListAllRoles() {
        List<Role> allRoles = roleRepository.listAll();

        assertNotNull(allRoles);
        assertEquals(4, allRoles.size(), "Should return all 4 seeded roles");
        assertTrue(allRoles.stream().anyMatch(r -> r.name() == RoleType.SUPERADMIN));
        assertTrue(allRoles.stream().anyMatch(r -> r.name() == RoleType.RECTOR));
        assertTrue(allRoles.stream().anyMatch(r -> r.name() == RoleType.DECANO));
        assertTrue(allRoles.stream().anyMatch(r -> r.name() == RoleType.DIRECTOR));
    }
}
