package uatf.dss.authservice.domain.exception;

public class RoleAlreadyAssignedException extends RuntimeException{
    public RoleAlreadyAssignedException(){
        super("The role is already assigned to this user.");
    }
}
