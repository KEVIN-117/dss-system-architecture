package uatf.dss.authservice.domain.exception;

public class InvalidEmailException extends RuntimeException{
    public InvalidEmailException(){
        super("The email address provided is invalid.");
    }

    public InvalidEmailException(String message){
        super(message);
    }
}
