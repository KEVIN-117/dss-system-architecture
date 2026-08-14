package uatf.dss.authservice.domain.exception.conflict;

public class RoleAlreadyAssignedException extends ConflictException {
    public RoleAlreadyAssignedException(){
        super("The role is already assigned to this user.");
    }
}
