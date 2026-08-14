package uatf.dss.authservice.domain.exception.validation;

public class InvalidDeanAcademicContextException extends ValidationException {
    public InvalidDeanAcademicContextException(){
        super("Dean must have faculty but no career.");
    }
}
