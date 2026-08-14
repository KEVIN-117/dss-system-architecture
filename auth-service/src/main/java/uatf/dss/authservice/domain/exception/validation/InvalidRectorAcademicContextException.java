package uatf.dss.authservice.domain.exception.validation;

public class InvalidRectorAcademicContextException extends ValidationException {
    public InvalidRectorAcademicContextException(){
        super("Rector must not have faculty or career assigned.");
    }
}
