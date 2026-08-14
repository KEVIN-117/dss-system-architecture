package uatf.dss.authservice.domain.exception;

public class UserInactiveException extends RuntimeException{
    public UserInactiveException(){
        super("This account is inactive and cannot be used.");
    }
}
