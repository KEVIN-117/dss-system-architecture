package uatf.dss.authservice.domain.exception;

public class WeakPasswordException extends RuntimeException{
    public WeakPasswordException(){
        super("The password does not meet security requirements.");
    }
}
