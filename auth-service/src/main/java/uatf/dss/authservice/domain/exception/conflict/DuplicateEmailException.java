package uatf.dss.authservice.domain.exception.conflict;

public class DuplicateEmailException extends ConflictException {
    public DuplicateEmailException(){
        super("The email address is already registered.");
    }
}
