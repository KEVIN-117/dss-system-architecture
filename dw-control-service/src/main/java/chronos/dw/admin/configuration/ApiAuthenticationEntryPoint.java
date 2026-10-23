package chronos.dw.admin.configuration;

import chronos.dw.admin.adapter.in.rest.error.ApiProblemWriter;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

@Component
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ApiProblemWriter problemWriter;

    public ApiAuthenticationEntryPoint(ApiProblemWriter problemWriter) {
        this.problemWriter = problemWriter;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
            throws IOException, ServletException {
        response.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        problemWriter.write(
                request,
                response,
                HttpStatus.UNAUTHORIZED,
                "No autenticado",
                "Se requiere un token de acceso válido.",
                "UNAUTHENTICATED");
    }
}
