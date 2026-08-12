package uatf.dss.authservice.application.service;

import uatf.dss.authservice.application.port.in.RegisterExampleUserCommand;
import uatf.dss.authservice.application.port.in.RegisterExampleUserUseCase;
import uatf.dss.authservice.application.port.out.ExampleUserRepository;
import uatf.dss.authservice.domain.exception.ExampleUserAlreadyExistsException;
import uatf.dss.authservice.domain.model.ExampleUser;

public class RegisterExampleUserService implements RegisterExampleUserUseCase {
    private final ExampleUserRepository userRepository;

    public RegisterExampleUserService(ExampleUserRepository userRepository){
        this.userRepository = userRepository;
    }

    @Override
    public ExampleUser register(RegisterExampleUserCommand command){
        this.userRepository.findByEmail(command.email())
                .ifPresent(u -> {
                    throw new ExampleUserAlreadyExistsException(command.email());
                });

        return this.userRepository.save(new ExampleUser(command.id(), command.email()));
    }
}
