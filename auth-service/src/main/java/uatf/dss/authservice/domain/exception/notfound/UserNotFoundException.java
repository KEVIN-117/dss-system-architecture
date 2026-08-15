package uatf.dss.authservice.domain.exception.notfound;

public class UserNotFoundException extends NotFoundException {
    public UserNotFoundException() {
        super("User not found");
    }
}
