package uatf.dss.authservice.domain.exception;

public class RoleAssignmentException extends RuntimeException{
    public RoleAssignmentException(){
        super("The role assignment is invalid for this user.");
    }
}
