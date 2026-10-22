package uatf.dss.authservice.configuration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import uatf.dss.authservice.application.port.in.GetAuthUserProfileUseCase;
import uatf.dss.authservice.application.port.in.ListAcademicCatalogUseCase;
import uatf.dss.authservice.application.port.in.RegisterExampleUserUseCase;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsUseCase;
import uatf.dss.authservice.application.port.out.AcademicCatalogRepository;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.application.port.out.ExampleUserRepository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.application.service.GetAuthUserProfileService;
import uatf.dss.authservice.application.service.ListAcademicCatalogService;
import uatf.dss.authservice.application.service.AdminUserDirectoryService;
import uatf.dss.authservice.application.service.RegisterExampleUserService;
import uatf.dss.authservice.application.service.SyncUserService;
import uatf.dss.authservice.application.service.SetUserAcademicContextsService;

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

    @Bean
    public AdminUserDirectoryService adminUserDirectoryService(UserRepository userRepository, AcademicContextRepository contextRepository) {
        return new AdminUserDirectoryService(userRepository, contextRepository);
    }

    @Bean
    public SetUserAcademicContextsUseCase setUserAcademicContextsUseCase(
            UserRepository userRepository,
            AcademicContextRepository contextRepository,
            AcademicCatalogRepository catalogRepository) {
        return new SetUserAcademicContextsService(userRepository, contextRepository, catalogRepository);
    }

    @Bean
    public ListAcademicCatalogUseCase listAcademicCatalogUseCase(AcademicCatalogRepository catalogRepository) {
        return new ListAcademicCatalogService(catalogRepository);
    }
}
