package uatf.dss.authservice.domain.exception.notfound;

public class UserNotFoundException extends NotFoundException {
    public UserNotFoundException(String email) {
        super("User " + " with email: " + email + " not found");
    }
}
