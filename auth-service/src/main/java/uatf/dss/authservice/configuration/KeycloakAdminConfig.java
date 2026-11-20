package uatf.dss.authservice.configuration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import uatf.dss.authservice.adapter.out.keycloak.KeycloakAdminModule;
import uatf.dss.authservice.adapter.out.keycloak.KeycloakAdminProperties;
import uatf.dss.authservice.application.port.out.IdentityClientAdminPort;
import uatf.dss.authservice.application.port.out.IdentityRoleAdminPort;
import uatf.dss.authservice.application.port.out.IdentityRoleMappingPort;
import uatf.dss.authservice.application.port.out.IdentityUserAdminPort;

import java.time.Clock;

/**
 * Wires the Keycloak Admin REST API adapter (IAM-003). Missing credentials do not stop the service from starting:
 * the existing endpoints keep working and identity-administration calls fail with 503 until the secret is set.
 */
@Configuration
@EnableConfigurationProperties(KeycloakAdminProperties.class)
public class KeycloakAdminConfig {

    private static final Logger log = LoggerFactory.getLogger(KeycloakAdminConfig.class);

    @Bean
    public KeycloakAdminModule keycloakAdminModule(KeycloakAdminProperties properties) {
        if (properties.hasClientSecret()) {
            log.info("Keycloak Admin API configurada: {}", properties);
        } else {
            log.warn("KEYCLOAK_AUTH_SERVICE_CLIENT_SECRET no está definido: la administración de identidad responderá 503. {}",
                    properties);
        }
        return KeycloakAdminModule.create(properties, Clock.systemUTC());
    }

    @Bean
    public IdentityUserAdminPort identityUserAdminPort(KeycloakAdminModule module) {
        return module.users();
    }

    @Bean
    public IdentityRoleAdminPort identityRoleAdminPort(KeycloakAdminModule module) {
        return module.roles();
    }

    @Bean
    public IdentityRoleMappingPort identityRoleMappingPort(KeycloakAdminModule module) {
        return module.roleMappings();
    }

    @Bean
    public IdentityClientAdminPort identityClientAdminPort(KeycloakAdminModule module) {
        return module.clients();
    }
}
