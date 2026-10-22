package uatf.dss.authservice.adapter.in.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import jakarta.validation.ConstraintViolationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import uatf.dss.authservice.domain.exception.DomainException;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ConstraintViolationException.class)
    public ProblemDetail handleConstraintViolation(ConstraintViolationException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                "Uno o más parámetros de la solicitud no son válidos.");
        problemDetail.setTitle("INVALID_REQUEST");
        return problemDetail;
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ProblemDetail handleUserNotFound(UserNotFoundException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND,
                "El perfil del usuario aún no se ha sincronizado desde Keycloak."
        );
        problemDetail.setTitle("USER_NOT_SYNCED");
        return problemDetail;
    }

    @ExceptionHandler(DomainException.class)
    public ProblemDetail handleDomainException(DomainException ex) {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(
                HttpStatus.valueOf(ex.getHttpStatus()), ex.getMessage());
        problemDetail.setTitle(ex.getClass().getSimpleName());
        return problemDetail;
    }
}
