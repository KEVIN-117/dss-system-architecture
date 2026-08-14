package uatf.dss.authservice.domain.exception;

public class InvalidUsernameException extends RuntimeException{
    public InvalidUsernameException(){
        super("The username provided is invalid or not allowed.");
    }

    public InvalidUsernameException(String message){
        super(message);
    }
}
