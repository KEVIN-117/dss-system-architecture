package uatf.dss.authservice.domain.exception.validation;

public class RoleAssignmentException extends ValidationException {
    public RoleAssignmentException() {
        super("Role assignment failed.");
    }

    public RoleAssignmentException(String message) {
        super(message);
    }
}
