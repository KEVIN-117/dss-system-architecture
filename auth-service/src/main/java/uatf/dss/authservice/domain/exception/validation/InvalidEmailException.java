package uatf.dss.authservice.domain.exception.validation;

public class InvalidEmailException extends ValidationException {
    public InvalidEmailException(){
        super("The email address provided is invalid.");
    }

    public InvalidEmailException(String message){
        super(message);
    }
}