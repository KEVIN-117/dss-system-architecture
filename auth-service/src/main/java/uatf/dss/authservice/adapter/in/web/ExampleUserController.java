package uatf.dss.authservice.adapter.in.web;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uatf.dss.authservice.application.port.in.RegisterExampleUserCommand;
import uatf.dss.authservice.application.port.in.RegisterExampleUserUseCase;

@RestController
@RequestMapping("/example-user")
public class ExampleUserController {

    private final RegisterExampleUserUseCase useCase;

    public ExampleUserController(RegisterExampleUserUseCase useCase){
        this.useCase = useCase;
    }

    @PostMapping
    public void register(@RequestBody RegisterExampleUserRequest request){
        RegisterExampleUserCommand command = new RegisterExampleUserCommand(request.id(), request.email());
        useCase.register(command);
    }
}
