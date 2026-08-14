package uatf.dss.authservice.domain.exception;

public class InvalidDirectorAcademicContextException extends RuntimeException{
    public InvalidDirectorAcademicContextException(){
        super("Director must have both faculty and career.");
    }
}
