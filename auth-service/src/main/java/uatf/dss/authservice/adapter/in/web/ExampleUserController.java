package uatf.dss.authservice.adapter.in.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uatf.dss.authservice.application.port.in.RegisterExampleUserCommand;
import uatf.dss.authservice.application.port.in.RegisterExampleUserUseCase;
import uatf.dss.authservice.domain.exception.ExampleUserAlreadyExistsException;

@RestController
@RequestMapping("/example-user")
public class ExampleUserController {

    private final RegisterExampleUserUseCase useCase;

    public ExampleUserController(RegisterExampleUserUseCase useCase){
        this.useCase = useCase;
    }

    @PostMapping
    public ResponseEntity<Void> register(@RequestBody RegisterExampleUserRequest request){
        RegisterExampleUserCommand command = new RegisterExampleUserCommand(request.id(), request.email());

        try {
            useCase.register(command);
            return ResponseEntity.status(HttpStatus.CREATED).build();
        }catch (ExampleUserAlreadyExistsException ex){
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
    }
}
