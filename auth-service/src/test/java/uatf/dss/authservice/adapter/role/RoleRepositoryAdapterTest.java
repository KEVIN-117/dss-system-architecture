package uatf.dss.authservice.adapter.role;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uatf.dss.authservice.adapter.out.persistence.role.*;
import uatf.dss.authservice.adapter.out.persistence.role.RoleEntity;
import uatf.dss.authservice.adapter.out.persistence.role.RolePersistenceMapper;
import uatf.dss.authservice.adapter.out.persistence.role.RoleRepositoryAdapter;
import uatf.dss.authservice.adapter.out.persistence.role.SpringDataRoleRepository;
import uatf.dss.authservice.domain.model.Role;
import uatf.dss.authservice.domain.model.RoleType;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("RoleRepositoryAdapter Unit Tests")
class RoleRepositoryAdapterTest {

    @Mock
    private SpringDataRoleRepository springDataRepository;

    private RoleRepositoryAdapter adapter;

    @BeforeEach
    void setUp() {
        RolePersistenceMapper mapper = Mappers.getMapper(RolePersistenceMapper.class);
        adapter = new RoleRepositoryAdapter(springDataRepository, mapper);
    }

    @Test
    @DisplayName("Should find role by name and map to domain enum")
    void shouldFindByName() {
        RoleEntity entity = new RoleEntity(1, "SUPERADMIN", "Super Admin role", null);
        when(springDataRepository.findByName("SUPERADMIN")).thenReturn(Optional.of(entity));

        Optional<Role> result = adapter.findByName("SUPERADMIN");

        assertTrue(result.isPresent());
        assertEquals(1, result.get().id());
        assertEquals(RoleType.SUPERADMIN, result.get().name());
        assertEquals("Super Admin role", result.get().description());
    }

    @Test
    @DisplayName("Should return empty when role not found")
    void shouldReturnEmptyWhenNotFound() {
        when(springDataRepository.findByName("UNKNOWN")).thenReturn(Optional.empty());

        Optional<Role> result = adapter.findByName("UNKNOWN");

        assertFalse(result.isPresent());
    }

    @Test
    @DisplayName("Should list all roles mapped to domain records")
    void shouldListAllRoles() {
        RoleEntity r1 = new RoleEntity(1, "SUPERADMIN", "Super Admin", null);
        RoleEntity r2 = new RoleEntity(2, "RECTOR", "Rector", null);
        when(springDataRepository.findAll()).thenReturn(List.of(r1, r2));

        List<Role> result = adapter.listAll();

        assertEquals(2, result.size());
        assertEquals(RoleType.SUPERADMIN, result.get(0).name());
        assertEquals(RoleType.RECTOR, result.get(1).name());
    }
}
