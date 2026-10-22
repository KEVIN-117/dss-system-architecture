package chronos.dw.admin.configuration;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http, JwtDecoder jwtDecoder, DwControlJwtAuthenticationConverter authenticationConverter)
            throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/actuator/health",
                                "/actuator/health/**",
                                "/actuator/info",
                                "/livez",
                                "/readyz",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html")
                        .permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/academic-closures", "/api/v1/academic-closures/**")
                        .hasAuthority("DW_CLOSURE_READ")
                        .requestMatchers(HttpMethod.POST, "/api/v1/academic-closures", "/api/v1/academic-closures/**")
                        .hasAuthority("DW_CLOSURE_MANAGE")
                        .requestMatchers(HttpMethod.GET, "/api/v1/etl/executions", "/api/v1/etl/executions/**")
                        .hasAuthority("DW_ETL_MONITOR_READ")
                        .anyRequest()
                        .denyAll())
                .oauth2ResourceServer(resourceServer -> resourceServer.jwt(
                        jwt -> jwt.decoder(jwtDecoder).jwtAuthenticationConverter(authenticationConverter)));
        return http.build();
    }

    @Bean
    DwControlJwtAuthenticationConverter dwControlJwtAuthenticationConverter(
            @Value("${app.security.jwt.client-id}") String clientId) {
        return new DwControlJwtAuthenticationConverter(clientId);
    }

    @Bean
    JwtDecoder jwtDecoder(
            @Value("${app.security.jwt.jwk-set-uri}") String jwkSetUri,
            @Value("${app.security.jwt.issuer-uri}") String issuerUri,
            @Value("${app.security.jwt.audience}") String audience) {
        requireConfigured(jwkSetUri, "JWK Set URI");
        requireConfigured(issuerUri, "issuer URI");
        requireConfigured(audience, "audience");

        NimbusJwtDecoder decoder =
                NimbusJwtDecoder.withJwkSetUri(jwkSetUri.trim()).build();
        decoder.setJwtValidator(jwtValidator(issuerUri.trim(), audience.trim()));
        return decoder;
    }

    static OAuth2TokenValidator<Jwt> jwtValidator(String issuerUri, String audience) {
        OAuth2TokenValidator<Jwt> issuerAndTimeValidator = JwtValidators.createDefaultWithIssuer(issuerUri);
        OAuth2TokenValidator<Jwt> audienceValidator = new JwtClaimValidator<List<String>>(
                JwtClaimNames.AUD, audiences -> audiences != null && audiences.contains(audience));
        return new DelegatingOAuth2TokenValidator<>(issuerAndTimeValidator, audienceValidator);
    }

    private static void requireConfigured(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Keycloak " + name + " must be configured");
        }
    }
}
