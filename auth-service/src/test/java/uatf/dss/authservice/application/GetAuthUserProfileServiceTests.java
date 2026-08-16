package uatf.dss.authservice.application;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uatf.dss.authservice.application.port.in.AuthUserProfile;
import uatf.dss.authservice.application.port.in.GetAuthUserProfileCommand;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.application.service.GetAuthUserProfileService;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class GetAuthUserProfileServiceTests {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AcademicContextRepository contextRepository;

    @InjectMocks
    private GetAuthUserProfileService userProfileService;

    @Test
    public void shouldReturnUserProfileWhenUserExists() {
        // Arrange
        UUID keycloakId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        
        GetAuthUserProfileCommand command = new GetAuthUserProfileCommand(keycloakId);
        
        User user = User.create(
                userId,
                keycloakId,
                "krodriguez",
                "krodriguez@uatf.edu.bo",
                "Kevin",
                "Rodriguez",
                true
        );
        
        UserAcademicContext context = new UserAcademicContext(
                UUID.randomUUID(),
                userId,
                1,
                1
        );

        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.of(user));
        when(contextRepository.findAllByUserId(userId)).thenReturn(List.of(context));

        // Act
        AuthUserProfile profile = userProfileService.execute(command);

        // Assert
        assertNotNull(profile);
        assertEquals(userId, profile.id());
        assertEquals("krodriguez", profile.username());
        assertEquals("krodriguez@uatf.edu.bo", profile.email());
        assertEquals("Kevin", profile.firstName());
        assertEquals("Rodriguez", profile.lastName());
        assertTrue(profile.isActive());
        assertEquals(1, profile.academicContexts().size());
        assertEquals(context.id(), profile.academicContexts().getFirst().id());

        verify(userRepository, times(1)).findByKeycloakId(keycloakId);
        verify(contextRepository, times(1)).findAllByUserId(userId);
    }

    @Test
    public void shouldThrowExceptionWhenUserNotFound() {
        // Arrange
        UUID keycloakId = UUID.randomUUID();
        GetAuthUserProfileCommand command = new GetAuthUserProfileCommand(keycloakId);

        when(userRepository.findByKeycloakId(keycloakId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(UserNotFoundException.class, () -> {
            userProfileService.execute(command);
        });

        verify(userRepository, times(1)).findByKeycloakId(keycloakId);
        verify(contextRepository, never()).findAllByUserId(any());
    }
}
