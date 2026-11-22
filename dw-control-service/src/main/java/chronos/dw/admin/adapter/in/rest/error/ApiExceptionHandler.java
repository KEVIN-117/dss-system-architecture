package chronos.dw.admin.adapter.in.rest.error;

import chronos.dw.admin.domain.exception.AcademicClosureNotFoundException;
import chronos.dw.admin.domain.exception.EtlExecutionNotFoundException;
import chronos.dw.admin.domain.exception.EtlLaunchConflictException;
import chronos.dw.admin.domain.exception.EtlLaunchNotFoundException;
import chronos.dw.admin.domain.exception.EtlProcessNotFoundException;
import chronos.dw.admin.domain.exception.EtlScheduleConflictException;
import chronos.dw.admin.domain.exception.EtlScheduleNotFoundException;
import chronos.dw.admin.domain.exception.HopRequestRejectedException;
import chronos.dw.admin.domain.exception.HopUnavailableException;
import chronos.dw.admin.domain.exception.InvalidClosureTransitionException;
import chronos.dw.admin.domain.exception.InvalidEtlLaunchRequestException;
import chronos.dw.admin.domain.exception.InvalidEtlScheduleException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.sql.SQLException;
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

    @ExceptionHandler(AcademicClosureNotFoundException.class)
    public ResponseEntity<ApiProblemResponse> closureNotFound(
            AcademicClosureNotFoundException exception, HttpServletRequest request) {
        return response(
                HttpStatus.NOT_FOUND,
                "No encontrado",
                "No se encontró el cierre académico solicitado.",
                "NOT_FOUND",
                request);
    }

    @ExceptionHandler(EtlExecutionNotFoundException.class)
    public ResponseEntity<ApiProblemResponse> executionNotFound(
            EtlExecutionNotFoundException exception, HttpServletRequest request) {
        return response(
                HttpStatus.NOT_FOUND,
                "No encontrado",
                "No se encontró la ejecución ETL solicitada.",
                "NOT_FOUND",
                request);
    }

    @ExceptionHandler(InvalidClosureTransitionException.class)
    public ResponseEntity<ApiProblemResponse> invalidClosureTransition(
            InvalidClosureTransitionException exception, HttpServletRequest request) {
        return response(
                HttpStatus.CONFLICT,
                "Conflicto",
                "La transición no es válida para el estado actual del cierre.",
                "CONFLICT",
                request);
    }

    @ExceptionHandler(EtlProcessNotFoundException.class)
    public ResponseEntity<ApiProblemResponse> processNotFound(
            EtlProcessNotFoundException exception, HttpServletRequest request) {
        return response(
                HttpStatus.NOT_FOUND,
                "No encontrado",
                "No se encontró el proceso ETL solicitado.",
                "NOT_FOUND",
                request);
    }

    @ExceptionHandler(EtlLaunchNotFoundException.class)
    public ResponseEntity<ApiProblemResponse> launchNotFound(
            EtlLaunchNotFoundException exception, HttpServletRequest request) {
        return response(
                HttpStatus.NOT_FOUND,
                "No encontrado",
                "No se encontró el lanzamiento ETL solicitado.",
                "NOT_FOUND",
                request);
    }

    @ExceptionHandler(EtlLaunchConflictException.class)
    public ResponseEntity<ApiProblemResponse> launchConflict(
            EtlLaunchConflictException exception, HttpServletRequest request) {
        return response(
                HttpStatus.CONFLICT,
                "Conflicto",
                "Ya hay una ejecución activa de este proceso o su estado no permite la operación.",
                "CONFLICT",
                request);
    }

    /** Messages are authored by LaunchEtlService and describe the missing or invalid launch input. */
    @ExceptionHandler(InvalidEtlLaunchRequestException.class)
    public ResponseEntity<ApiProblemResponse> invalidLaunch(
            InvalidEtlLaunchRequestException exception, HttpServletRequest request) {
        return response(HttpStatus.BAD_REQUEST, "Solicitud inválida", exception.getMessage(), "BAD_REQUEST", request);
    }

    /** Messages are authored by ScheduleService/OperatingWindowPolicy (cron, zone, frequency, DSA window). */
    @ExceptionHandler(InvalidEtlScheduleException.class)
    public ResponseEntity<ApiProblemResponse> invalidSchedule(
            InvalidEtlScheduleException exception, HttpServletRequest request) {
        return response(HttpStatus.BAD_REQUEST, "Solicitud inválida", exception.getMessage(), "BAD_REQUEST", request);
    }

    @ExceptionHandler(EtlScheduleNotFoundException.class)
    public ResponseEntity<ApiProblemResponse> scheduleNotFound(
            EtlScheduleNotFoundException exception, HttpServletRequest request) {
        return response(
                HttpStatus.NOT_FOUND,
                "No encontrado",
                "No se encontró la programación solicitada.",
                "NOT_FOUND",
                request);
    }

    @ExceptionHandler(EtlScheduleConflictException.class)
    public ResponseEntity<ApiProblemResponse> scheduleConflict(
            EtlScheduleConflictException exception, HttpServletRequest request) {
        return response(
                HttpStatus.CONFLICT,
                "Conflicto",
                "La programación cambió, está disparándose o su nombre ya existe. Vuelve a cargarla.",
                "CONFLICT",
                request);
    }

    @ExceptionHandler(HopUnavailableException.class)
    public ResponseEntity<ApiProblemResponse> hopUnavailable(
            HopUnavailableException exception, HttpServletRequest request) {
        return response(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Servicio no disponible",
                "Hop Server no está disponible temporalmente.",
                "HOP_UNAVAILABLE",
                request);
    }

    @ExceptionHandler(HopRequestRejectedException.class)
    public ResponseEntity<ApiProblemResponse> hopRejected(
            HopRequestRejectedException exception, HttpServletRequest request) {
        return response(
                HttpStatus.BAD_GATEWAY,
                "Error de Hop Server",
                "Hop Server rechazó la solicitud.",
                "HOP_REJECTED",
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
        String sqlState = sqlState(exception);
        if ("P0002".equals(sqlState) || "23503".equals(sqlState)) {
            return response(
                    HttpStatus.NOT_FOUND,
                    "No encontrado",
                    "No se encontró el cierre académico solicitado.",
                    "NOT_FOUND",
                    request);
        }
        if ("23505".equals(sqlState)) {
            return response(
                    HttpStatus.CONFLICT,
                    "Conflicto",
                    "Ya existe un cierre para esa gestión y periodo.",
                    "CONFLICT",
                    request);
        }
        if ("23514".equals(sqlState)) {
            return response(
                    HttpStatus.CONFLICT,
                    "Conflicto",
                    "La operación no es compatible con el estado actual del cierre.",
                    "CONFLICT",
                    request);
        }
        if ("22023".equals(sqlState) || "22001".equals(sqlState)) {
            return response(
                    HttpStatus.BAD_REQUEST,
                    "Solicitud inválida",
                    "Revisa los parámetros y el contenido de la solicitud.",
                    "BAD_REQUEST",
                    request);
        }
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

    private static String sqlState(Throwable exception) {
        Throwable current = exception;
        while (current != null) {
            if (current instanceof SQLException sqlException) {
                return sqlException.getSQLState();
            }
            current = current.getCause();
        }
        return null;
    }

    private static ResponseEntity<ApiProblemResponse> response(
            HttpStatusCode status, String title, String detail, String code, HttpServletRequest request) {
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .header("Cache-Control", "no-store")
                .body(ApiProblemResponse.forRequest(status.value(), title, detail, code, request));
    }
}
