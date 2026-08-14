package uatf.dss.authservice.domain.exception;

public class DuplicateEmailException extends RuntimeException{
    public DuplicateEmailException(){
        super("The email address is already registered.");
    }
}
