package uatf.dss.authservice.application.service;

import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.Email;

public class SyncUserService implements SyncUserUseCase {

    private final UserRepository userRepository;

    public SyncUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public User sync(SyncUserCommand command) {
        return userRepository.findByKeycloakId(command.keycloakId())
                .map(existingUser -> {
                    User updatedUser = User.create(
                            existingUser.id(),
                            existingUser.keycloakId(),
                            command.username(),
                            command.email(),
                            command.firstName(),
                            command.lastName(),
                            command.isActive()
                    );
                    return userRepository.save(updatedUser);
                })
                .orElseGet(() -> {
                    User newUser = User.create(
                            null,
                            command.keycloakId(),
                            command.username(),
                            command.email(),
                            command.firstName(),
                            command.lastName(),
                            command.isActive()
                    );
                    return userRepository.save(newUser);
                });
    }
}
