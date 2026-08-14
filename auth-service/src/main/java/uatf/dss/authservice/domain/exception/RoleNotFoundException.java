package uatf.dss.authservice.domain.exception;

public class RoleNotFoundException extends RuntimeException{
    public RoleNotFoundException(){
        super("The specified role does not exist.");
    }
}
