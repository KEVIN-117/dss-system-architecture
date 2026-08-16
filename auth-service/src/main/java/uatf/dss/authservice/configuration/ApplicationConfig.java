package uatf.dss.authservice.configuration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import uatf.dss.authservice.application.port.in.GetAuthUserProfileUseCase;
import uatf.dss.authservice.application.port.in.RegisterExampleUserUseCase;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.application.port.out.ExampleUserRepository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.application.service.GetAuthUserProfileService;
import uatf.dss.authservice.application.service.RegisterExampleUserService;
import uatf.dss.authservice.application.service.SyncUserService;

@Configuration
public class ApplicationConfig {

    @Bean
    public RegisterExampleUserUseCase registerExampleUserUseCase(ExampleUserRepository userRepository) {
        return new RegisterExampleUserService(userRepository);
    }

    @Bean
    public SyncUserUseCase syncUserUseCase(UserRepository userRepository) {
        return new SyncUserService(userRepository);
    }

    @Bean
    public GetAuthUserProfileUseCase userProfileUseCase(UserRepository userRepository, AcademicContextRepository contextRepository){
        return new GetAuthUserProfileService(userRepository, contextRepository);
    }
}
