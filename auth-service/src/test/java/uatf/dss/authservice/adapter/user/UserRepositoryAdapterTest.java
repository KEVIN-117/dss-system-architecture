package uatf.dss.authservice.adapter.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uatf.dss.authservice.adapter.out.persistence.user.SpringDataUserRepository;
import uatf.dss.authservice.adapter.out.persistence.user.UserEntity;
import uatf.dss.authservice.adapter.out.persistence.user.UserPersistenceMapper;
import uatf.dss.authservice.adapter.out.persistence.user.UserRepositoryAdapter;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.model.User;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserRepositoryAdapter Unit Tests")
class UserRepositoryAdapterTest {

    @Mock
    private SpringDataUserRepository springDataRepository;

    private UserRepositoryAdapter adapter;

    @BeforeEach
    void setUp() {
        UserPersistenceMapper mapper = Mappers.getMapper(UserPersistenceMapper.class);
        adapter = new UserRepositoryAdapter(springDataRepository, mapper);
    }

    @Test
    @DisplayName("Should save user and return domain model")
    void shouldSaveUser() {
        UUID keycloakId = UUID.randomUUID();
        User domainUser = User.create(
                null,
                keycloakId,
                "krodriguez",
                "krodriguez@uatf.edu.bo",
                "Kevin",
                "Rodriguez",
                true
        );

        UUID generatedId = UUID.randomUUID();
        UserEntity savedEntity = new UserEntity();
        savedEntity.setId(generatedId);
        savedEntity.setKeycloakId(keycloakId);
        savedEntity.setUsername("krodriguez");
        savedEntity.setEmail("krodriguez@uatf.edu.bo");
        savedEntity.setFirstName("Kevin");
        savedEntity.setLastName("Rodriguez");
        savedEntity.setActive(true);

        when(springDataRepository.save(any(UserEntity.class))).thenReturn(savedEntity);

        User result = adapter.save(domainUser);

        assertNotNull(result);
        assertEquals(generatedId, result.id());
        assertEquals(keycloakId, result.keycloakId());
        assertEquals("krodriguez", result.username());
        assertEquals("krodriguez@uatf.edu.bo", result.email().email());
        assertTrue(result.isActive());
        verify(springDataRepository).save(any(UserEntity.class));
    }

    @Test
    @DisplayName("Should find user by id")
    void shouldFindById() {
        UUID userId = UUID.randomUUID();
        UserEntity entity = new UserEntity();
        entity.setId(userId);
        entity.setKeycloakId(UUID.randomUUID());
        entity.setUsername("krodriguez");
        entity.setEmail("krodriguez@uatf.edu.bo");
        entity.setActive(true);

        when(springDataRepository.findById(userId)).thenReturn(Optional.of(entity));

        Optional<User> result = adapter.findById(userId);

        assertTrue(result.isPresent());
        assertEquals(userId, result.get().id());
        assertEquals("krodriguez", result.get().username());
    }

    @Test
    @DisplayName("Should find user by keycloakId")
    void shouldFindByKeycloakId() {
        UUID keycloakId = UUID.randomUUID();
        UserEntity entity = new UserEntity();
        entity.setId(UUID.randomUUID());
        entity.setKeycloakId(keycloakId);
        entity.setUsername("docente");
        entity.setEmail("docente@uatf.edu.bo");
        entity.setActive(true);

        when(springDataRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.of(entity));

        Optional<User> result = adapter.findByKeycloakId(keycloakId);

        assertTrue(result.isPresent());
        assertEquals(keycloakId, result.get().keycloakId());
    }

    @Test
    @DisplayName("Should find user by email")
    void shouldFindByEmail() {
        String email = "rector@uatf.edu.bo";
        UserEntity entity = new UserEntity();
        entity.setId(UUID.randomUUID());
        entity.setKeycloakId(UUID.randomUUID());
        entity.setUsername("rector");
        entity.setEmail(email);
        entity.setActive(true);

        when(springDataRepository.findByEmail(email)).thenReturn(Optional.of(entity));

        Optional<User> result = adapter.findByEmail(email);

        assertTrue(result.isPresent());
        assertEquals(email, result.get().email().email());
    }

    @Test
    @DisplayName("Should check existsByEmail")
    void shouldCheckExistsByEmail() {
        when(springDataRepository.existsByEmail("test@uatf.edu.bo")).thenReturn(true);
        when(springDataRepository.existsByEmail("other@uatf.edu.bo")).thenReturn(false);

        assertTrue(adapter.existsByEmail("test@uatf.edu.bo"));
        assertFalse(adapter.existsByEmail("other@uatf.edu.bo"));
    }

    @Test
    @DisplayName("Should perform soft delete by setting active to false and saving")
    void shouldSoftDelete() {
        UUID userId = UUID.randomUUID();
        UserEntity entity = new UserEntity();
        entity.setId(userId);
        entity.setActive(true);

        when(springDataRepository.findById(userId)).thenReturn(Optional.of(entity));
        when(springDataRepository.save(entity)).thenReturn(entity);

        adapter.delete(userId);

        assertFalse(entity.isActive(), "Active flag should be updated to false");
        verify(springDataRepository).save(entity);
    }

    @Test
    @DisplayName("Should throw UserNotFoundException when deleting non-existent user")
    void shouldThrowNotFoundExceptionOnDelete() {
        UUID nonExistentId = UUID.randomUUID();
        when(springDataRepository.findById(nonExistentId)).thenReturn(Optional.empty());

        assertThrows(UserNotFoundException.class, () -> adapter.delete(nonExistentId));
        verify(springDataRepository, never()).save(any());
    }
}
