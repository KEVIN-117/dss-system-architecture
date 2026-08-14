package uatf.dss.authservice.domain.exception;

public class InvalidAcademicContextException extends RuntimeException{
    public InvalidAcademicContextException(){
        super("The academic context provided is invalid.");
    }
}
