package uatf.dss.authservice.user;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.application.service.SyncUserService;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.Email;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class SyncUserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SyncUserService syncUserService;

    @Test
    public void shouldCreateNewUserWhenKeycloakIdNotExists() {
        UUID keycloakId = UUID.randomUUID();
        SyncUserCommand command = new SyncUserCommand(
                keycloakId,
                "krodriguez",
                "krodriguez@uatf.edu.bo",
                "Kevin",
                "Rodriguez",
                true
        );

        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.empty());
        
        User savedUser = new User(
                UUID.randomUUID(),
                keycloakId,
                command.username(),
                new Email(command.email()),
                command.firstName(),
                command.lastName(),
                command.isActive()
        );
        when(userRepository.save(any(User.class))).thenReturn(savedUser);

        User result = syncUserService.sync(command);

        assertNotNull(result);
        assertEquals(savedUser.id(), result.id());
        assertEquals(keycloakId, result.keycloakId());
        assertEquals("krodriguez", result.username());
        assertEquals("krodriguez@uatf.edu.bo", result.email().email());
        assertEquals("Kevin", result.firstName());
        assertEquals("Rodriguez", result.lastName());
        assertTrue(result.isActive());

        verify(userRepository).findByKeycloakId(keycloakId);
        
        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User capturedUser = userCaptor.getValue();
        assertNull(capturedUser.id());
        assertEquals(keycloakId, capturedUser.keycloakId());
        assertEquals("krodriguez", capturedUser.username());
        assertEquals("Kevin", capturedUser.firstName());
        assertEquals("Rodriguez", capturedUser.lastName());
        assertTrue(capturedUser.isActive());
    }

    @Test
    public void shouldUpdateExistingUserWhenKeycloakIdAlreadyExists() {
        UUID keycloakId = UUID.randomUUID();
        UUID localId = UUID.randomUUID();
        SyncUserCommand command = new SyncUserCommand(
                keycloakId,
                "krodriguez.updated",
                "krodriguez.upd@uatf.edu.bo",
                "Kevin Upd",
                "Rodriguez Upd",
                false
        );

        User existingUser = User.create(
                localId,
                keycloakId,
                "krodriguez",
                "krodriguez@uatf.edu.bo",
                "Kevin",
                "Rodriguez",
                true
        );

        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.of(existingUser));
        
        User updatedUser = new User(
                localId,
                keycloakId,
                command.username(),
                new Email(command.email()),
                command.firstName(),
                command.lastName(),
                command.isActive()
        );
        when(userRepository.save(any(User.class))).thenReturn(updatedUser);

        User result = syncUserService.sync(command);

        assertNotNull(result);
        assertEquals(localId, result.id());
        assertEquals(keycloakId, result.keycloakId());
        assertEquals("krodriguez.updated", result.username());
        assertEquals("krodriguez.upd@uatf.edu.bo", result.email().email());
        assertFalse(result.isActive());

        verify(userRepository).findByKeycloakId(keycloakId);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User capturedUser = userCaptor.getValue();
        assertEquals(localId, capturedUser.id());
        assertEquals(keycloakId, capturedUser.keycloakId());
        assertEquals("krodriguez.updated", capturedUser.username());
        assertEquals("krodriguez.upd@uatf.edu.bo", capturedUser.email().email());
    }
}
