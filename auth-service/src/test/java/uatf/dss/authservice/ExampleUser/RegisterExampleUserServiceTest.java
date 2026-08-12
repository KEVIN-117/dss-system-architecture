package uatf.dss.authservice.ExampleUser;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import uatf.dss.authservice.application.port.in.RegisterExampleUserCommand;
import uatf.dss.authservice.application.port.out.ExampleUserRepository;
import uatf.dss.authservice.application.service.RegisterExampleUserService;
import uatf.dss.authservice.domain.exception.ExampleUserAlreadyExistsException;
import uatf.dss.authservice.domain.model.ExampleUser;


import java.util.Optional;
import java.util.UUID;

@ExtendWith(MockitoExtension.class)
public class RegisterExampleUserServiceTest {
    @Mock
    private ExampleUserRepository userRepository;

    @InjectMocks
    private RegisterExampleUserService userService;


    @Test
    public void shouldSaveUserSuccessfully(){
        RegisterExampleUserCommand request = new RegisterExampleUserCommand(UUID.randomUUID().toString(), "example@gmail.com");

        ExampleUser user = new ExampleUser(request.id(), request.email());

        when(userRepository.save(any(ExampleUser.class))).thenReturn(user);

        ExampleUser result = this.userService.register(request);

        assertEquals(result.id(), user.id());
        assertEquals(result.email(), user.email());

        verify(userRepository).findByEmail(request.email());

        ArgumentCaptor<ExampleUser> userCaptor = ArgumentCaptor.forClass(ExampleUser.class);
        verify(userRepository).save(userCaptor.capture());

        ExampleUser savedUser = userCaptor.getValue();
        assertEquals(request.id(), savedUser.id());
        assertEquals(request.email(), savedUser.email());
    }

    @Test
    public void shouldSaveUserConflict(){
        String email = "example@gmail.com";
        RegisterExampleUserCommand command = new RegisterExampleUserCommand(UUID.randomUUID().toString(), email);

        when(userRepository.findByEmail(email)).thenReturn(Optional.of(new ExampleUser(UUID.randomUUID().toString(), email)));

        assertThrows(ExampleUserAlreadyExistsException.class, () -> userService.register(command));

        verify(userRepository, never()).save(any());
    }
}
