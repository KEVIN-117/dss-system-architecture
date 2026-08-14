package uatf.dss.authservice.domain.exception.validation;

public class FacultyRequiredException extends ValidationException {
    public FacultyRequiredException() {
        super("Faculty ID is required.");
    }

    public FacultyRequiredException(String message) {
        super(message);
    }
}
