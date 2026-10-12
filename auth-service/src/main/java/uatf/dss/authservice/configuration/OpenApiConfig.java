package uatf.dss.authservice.configuration;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.security.SecuritySchemes;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
        info = @Info(
                title = "DSS UATF Auth Service API",
                version = "1.0.0",
                description = "API de autenticación, perfil de usuario y contexto académico del DSS UATF."),
        tags = {
                @Tag(name = "Autenticación", description = "Consulta del perfil del usuario autenticado."),
                @Tag(name = "Administración", description = "Administración protegida de contextos académicos."),
                @Tag(name = "Demostración", description = "Rutas de ejemplo para validar roles del token."),
                @Tag(name = "Mensajería", description = "Consumidores de eventos de Keycloak desde RabbitMQ.")
        })
@SecuritySchemes({
        @SecurityScheme(
                name = "bearerAuth",
                type = SecuritySchemeType.HTTP,
                scheme = "bearer",
                bearerFormat = "JWT",
                description = "Access token emitido por Keycloak."),
})
public class OpenApiConfig {
}
