package uatf.dss.authservice.configuration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import uatf.dss.authservice.application.port.in.RegisterExampleUserUseCase;
import uatf.dss.authservice.application.port.out.ExampleUserRepository;
import uatf.dss.authservice.application.service.RegisterExampleUserService;

@Configuration
public class ApplicationConfig {

    @Bean
    public RegisterExampleUserUseCase registerExampleUserUseCase(ExampleUserRepository userRepository) {
        return new RegisterExampleUserService(userRepository);
    }
}
