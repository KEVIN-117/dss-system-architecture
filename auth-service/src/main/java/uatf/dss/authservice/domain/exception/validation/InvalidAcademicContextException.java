package uatf.dss.authservice.domain.exception.validation;

public class InvalidAcademicContextException extends ValidationException {
    public InvalidAcademicContextException(){
        super("The academic context provided is invalid.");
    }

    public InvalidAcademicContextException(String message){
        super(message);
    }
}
