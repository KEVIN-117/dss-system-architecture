package chronos.dw.admin.configuration;

import chronos.dw.admin.adapter.in.rest.error.ApiProblemWriter;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

@Component
public class ApiAccessDeniedHandler implements AccessDeniedHandler {

    private final ApiProblemWriter problemWriter;

    public ApiAccessDeniedHandler(ApiProblemWriter problemWriter) {
        this.problemWriter = problemWriter;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException exception)
            throws IOException, ServletException {
        problemWriter.write(
                request,
                response,
                HttpStatus.FORBIDDEN,
                "Acceso denegado",
                "No tienes permiso para realizar esta operación.",
                "FORBIDDEN");
    }
}
