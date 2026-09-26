package uatf.dss.authservice.configuration;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
public class WebhookSecretFilter extends OncePerRequestFilter {

    private final String expectedSecret;

    public WebhookSecretFilter(@Value("${app.security.webhook-secret:}") String expectedSecret) {
        if (expectedSecret == null || expectedSecret.isBlank()) {
            throw new IllegalStateException("KEYCLOAK_WEBHOOK_SECRET must be configured");
        }

        this.expectedSecret = expectedSecret;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (HttpMethod.POST.matches(request.getMethod()) && "/auth/sync".equals(request.getServletPath())) {
            String providedSecret = request.getHeader("X-Webhook-Secret");

            if (providedSecret == null || providedSecret.trim().isEmpty()) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Missing webhook secret");
                return;
            }

            byte[] expectedBytes = expectedSecret.getBytes(StandardCharsets.UTF_8);
            byte[] providedBytes = providedSecret.trim().getBytes(StandardCharsets.UTF_8);

            if (!MessageDigest.isEqual(expectedBytes, providedBytes)) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid webhook secret");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }
}
