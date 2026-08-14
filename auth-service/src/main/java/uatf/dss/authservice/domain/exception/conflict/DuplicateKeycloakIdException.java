package uatf.dss.authservice.domain.exception.conflict;

public class DuplicateKeycloakIdException extends ConflictException {
    public DuplicateKeycloakIdException(){
        super("This Keycloak ID is already linked to another user.");
    }
}
