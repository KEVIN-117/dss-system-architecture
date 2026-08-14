package uatf.dss.authservice.domain.exception.validation;

public class InvalidUsernameException extends ValidationException {
    public InvalidUsernameException(){
        super("The username provided is invalid or not allowed.");
    }

    public InvalidUsernameException(String message){
        super(message);
    }
}
