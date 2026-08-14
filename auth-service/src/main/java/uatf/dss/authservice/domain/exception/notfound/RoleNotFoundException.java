package uatf.dss.authservice.domain.exception.notfound;

public class RoleNotFoundException extends NotFoundException {
    public RoleNotFoundException(){
        super("The specified role does not exist.");
    }
}
