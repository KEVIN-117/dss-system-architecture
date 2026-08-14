package uatf.dss.authservice.domain.exception;

public class DuplicateKeycloakIdException extends RuntimeException{
    public DuplicateKeycloakIdException(){
        super("This Keycloak ID is already linked to another user.");
    }
}
