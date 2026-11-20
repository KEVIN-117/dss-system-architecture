package uatf.dss.authservice.configuration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import uatf.dss.authservice.application.port.in.GetAuthUserProfileUseCase;
import uatf.dss.authservice.application.port.in.ListAcademicCatalogUseCase;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsUseCase;
import uatf.dss.authservice.application.port.out.AcademicCatalogRepository;
import uatf.dss.authservice.application.port.out.AcademicContextRepository;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.application.service.GetAuthUserProfileService;
import uatf.dss.authservice.application.service.GetUserAcademicScopeService;
import uatf.dss.authservice.application.port.in.GetUserAcademicScopeUseCase;
import uatf.dss.authservice.application.service.ListAcademicCatalogService;
import uatf.dss.authservice.application.service.AdminUserDirectoryService;
import uatf.dss.authservice.application.service.SyncUserService;
import uatf.dss.authservice.application.service.SetUserAcademicContextsService;
import uatf.dss.authservice.application.service.AdminAuditRecorder;
import uatf.dss.authservice.application.service.ListAdminAuditService;
import uatf.dss.authservice.application.port.in.ListAdminAuditUseCase;
import uatf.dss.authservice.application.port.out.AdminAuditLogRepository;

import java.time.Clock;

@Configuration
public class ApplicationConfig {

    @Bean
    public SyncUserUseCase syncUserUseCase(UserRepository userRepository) {
        return new SyncUserService(userRepository);
    }

    @Bean
    public GetAuthUserProfileUseCase userProfileUseCase(UserRepository userRepository, AcademicContextRepository contextRepository){
        return new GetAuthUserProfileService(userRepository, contextRepository);
    }

    @Bean
    public GetUserAcademicScopeUseCase userAcademicScopeUseCase(UserRepository userRepository, AcademicContextRepository contextRepository) {
        return new GetUserAcademicScopeService(userRepository, contextRepository);
    }

    @Bean
    public AdminUserDirectoryService adminUserDirectoryService(UserRepository userRepository, AcademicContextRepository contextRepository) {
        return new AdminUserDirectoryService(userRepository, contextRepository);
    }

    @Bean
    public SetUserAcademicContextsUseCase setUserAcademicContextsUseCase(
            UserRepository userRepository,
            AcademicContextRepository contextRepository,
            AcademicCatalogRepository catalogRepository,
            AdminAuditRecorder adminAuditRecorder) {
        return new SetUserAcademicContextsService(userRepository, contextRepository, catalogRepository,
                adminAuditRecorder);
    }

    @Bean
    public AdminAuditRecorder adminAuditRecorder(AdminAuditLogRepository auditLogRepository) {
        return new AdminAuditRecorder(auditLogRepository, Clock.systemUTC());
    }

    @Bean
    public ListAdminAuditUseCase listAdminAuditUseCase(AdminAuditLogRepository auditLogRepository) {
        return new ListAdminAuditService(auditLogRepository);
    }

    @Bean
    public ListAcademicCatalogUseCase listAcademicCatalogUseCase(AcademicCatalogRepository catalogRepository) {
        return new ListAcademicCatalogService(catalogRepository);
    }
}
