package uatf.dss.authservice.domain.exception;

public class InvalidRoleAssignmentException extends RuntimeException{
    public InvalidRoleAssignmentException(String message){
        super(message);
    }
}
