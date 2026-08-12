package uatf.dss.authservice.ExampleUser;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import uatf.dss.authservice.application.port.in.RegisterExampleUserCommand;
import uatf.dss.authservice.application.port.out.ExampleUserRepository;
import uatf.dss.authservice.application.service.RegisterExampleUserService;
import uatf.dss.authservice.domain.model.ExampleUser;




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
    }
}
