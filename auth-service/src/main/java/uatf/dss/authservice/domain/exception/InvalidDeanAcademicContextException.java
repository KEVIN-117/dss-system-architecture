package uatf.dss.authservice.domain.exception;

public class InvalidDeanAcademicContextException extends RuntimeException{
    public InvalidDeanAcademicContextException(){
        super("Dean must have faculty but no career.");
    }
}
