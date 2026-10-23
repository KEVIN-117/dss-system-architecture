package chronos.dw.admin.adapter.in.rest.error;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(basePackages = "chronos.dw.admin.adapter.in.rest")
public class ApiExceptionHandler {

    @ExceptionHandler({
        BindException.class,
        ConstraintViolationException.class,
        HandlerMethodValidationException.class,
        HttpMessageNotReadableException.class,
        IllegalArgumentException.class,
        MethodArgumentTypeMismatchException.class,
        MissingServletRequestParameterException.class
    })
    public ResponseEntity<ApiProblemResponse> badRequest(Exception exception, HttpServletRequest request) {
        return response(
                HttpStatus.BAD_REQUEST,
                "Solicitud inválida",
                "Revisa los parámetros y el contenido de la solicitud.",
                "BAD_REQUEST",
                request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiProblemResponse> forbidden(AccessDeniedException exception, HttpServletRequest request) {
        return response(
                HttpStatus.FORBIDDEN,
                "Acceso denegado",
                "No tienes permiso para realizar esta operación.",
                "FORBIDDEN",
                request);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiProblemResponse> statusException(
            ResponseStatusException exception, HttpServletRequest request) {
        HttpStatusCode status = exception.getStatusCode();
        if (status.value() == HttpStatus.UNAUTHORIZED.value()) {
            return response(
                    status, "No autenticado", "Se requiere un token de acceso válido.", "UNAUTHENTICATED", request);
        }
        if (status.value() == HttpStatus.FORBIDDEN.value()) {
            return response(
                    status, "Acceso denegado", "No tienes permiso para realizar esta operación.", "FORBIDDEN", request);
        }
        if (status.value() == HttpStatus.NOT_FOUND.value()) {
            return response(status, "No encontrado", "No se encontró el recurso solicitado.", "NOT_FOUND", request);
        }
        if (status.value() == HttpStatus.CONFLICT.value()) {
            return response(
                    status,
                    "Conflicto",
                    "La operación no puede completarse con el estado actual del recurso.",
                    "CONFLICT",
                    request);
        }
        if (status.value() == HttpStatus.BAD_REQUEST.value()) {
            return response(
                    status,
                    "Solicitud inválida",
                    "Revisa los parámetros y el contenido de la solicitud.",
                    "BAD_REQUEST",
                    request);
        }
        if (status.value() == HttpStatus.SERVICE_UNAVAILABLE.value()) {
            return response(
                    status,
                    "Servicio no disponible",
                    "La dependencia requerida no está disponible temporalmente.",
                    "DEPENDENCY_UNAVAILABLE",
                    request);
        }
        return internalError(request);
    }

    @ExceptionHandler({DataAccessResourceFailureException.class, TransientDataAccessException.class})
    public ResponseEntity<ApiProblemResponse> databaseUnavailable(Exception exception, HttpServletRequest request) {
        return response(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Servicio no disponible",
                "La base de datos no está disponible temporalmente.",
                "DEPENDENCY_UNAVAILABLE",
                request);
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ApiProblemResponse> databaseFailure(
            DataAccessException exception, HttpServletRequest request) {
        return internalError(request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiProblemResponse> unexpected(Exception exception, HttpServletRequest request) {
        return internalError(request);
    }

    private static ResponseEntity<ApiProblemResponse> internalError(HttpServletRequest request) {
        return response(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Error interno",
                "Ocurrió un error al procesar la solicitud.",
                "INTERNAL_ERROR",
                request);
    }

    private static ResponseEntity<ApiProblemResponse> response(
            HttpStatusCode status, String title, String detail, String code, HttpServletRequest request) {
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .header("Cache-Control", "no-store")
                .body(ApiProblemResponse.forRequest(status.value(), title, detail, code, request));
    }
}
