package uatf.dss.authservice.application.service;

import uatf.dss.authservice.application.port.in.AuthUserProfile;
import uatf.dss.authservice.application.port.in.GetAuthUserProfileCommand;
import uatf.dss.authservice.application.port.in.GetAuthUserProfileUseCase;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;

public class GetAuthUserProfileService implements GetAuthUserProfileUseCase {

    private final UserRepository userRepository;
    private final AcademicContextRepository contextRepository;

    public GetAuthUserProfileService(UserRepository userRepository, AcademicContextRepository contextRepository){
        this.userRepository = userRepository;
        this.contextRepository = contextRepository;
    }
    @Override
    public AuthUserProfile execute(GetAuthUserProfileCommand command) {
        User user = userRepository.findByKeycloakId(command.keycloakId()).orElseThrow(UserNotFoundException::new);
        List<UserAcademicContext> academicContexts = contextRepository.findAllByUserId(user.id());

        return new AuthUserProfile(
                user.id(),
                user.username(),
                user.email().email(),
                user.firstName(),
                user.lastName(),
                user.isActive(),
                academicContexts
        );
    }
}
