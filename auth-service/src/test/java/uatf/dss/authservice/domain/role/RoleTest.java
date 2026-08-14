package uatf.dss.authservice.domain.role;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import uatf.dss.authservice.domain.model.Role;
import uatf.dss.authservice.domain.model.RoleType;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Feature: Role - Domain Model Unit Tests")
class RoleTest {

    @Test
    @DisplayName("Should instantiate Role record properly")
    void shouldCreateRoleProperly() {
        Integer id = 1;
        RoleType name = RoleType.RECTOR;
        String description = "Máxima autoridad universitaria con acceso global a las métricas";

        Role role = new Role(id, name, description);

        assertNotNull(role);
        assertEquals(id, role.id());
        assertEquals(name, role.name());
        assertEquals(description, role.description());
    }

    @ParameterizedTest
    @EnumSource(RoleType.class)
    @DisplayName("Should contain all expected RoleType enum constants")
    void shouldContainAllRoleTypes(RoleType roleType) {
        assertNotNull(roleType);
        assertTrue(roleType == RoleType.SUPERADMIN ||
                   roleType == RoleType.RECTOR ||
                   roleType == RoleType.DECANO ||
                   roleType == RoleType.DIRECTOR);
    }

    @Test
    @DisplayName("Should verify Role equality semantics")
    void shouldVerifyEquality() {
        Role role1 = new Role(1, RoleType.DECANO, "Decano");
        Role role2 = new Role(1, RoleType.DECANO, "Decano");
        Role role3 = new Role(2, RoleType.DIRECTOR, "Director");

        assertEquals(role1, role2);
        assertEquals(role1.hashCode(), role2.hashCode());
        assertNotEquals(role1, role3);
    }
}
