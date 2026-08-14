package uatf.dss.authservice.domain.exception.notfound;

public class UserAcademicContextNotFoundException extends NotFoundException {
    public UserAcademicContextNotFoundException() {
        super("User academic context not found.");
    }

    public UserAcademicContextNotFoundException(String message) {
        super(message);
    }
}
