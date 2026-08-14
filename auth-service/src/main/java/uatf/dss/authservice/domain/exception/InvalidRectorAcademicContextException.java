package uatf.dss.authservice.domain.exception;

public class InvalidRectorAcademicContextException extends RuntimeException{
    public InvalidRectorAcademicContextException(){
        super("Rector must not have faculty or career assigned.");
    }
}
