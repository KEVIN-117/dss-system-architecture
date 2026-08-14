package uatf.dss.authservice.domain.exception.validation;

public class InvalidDirectorAcademicContextException extends ValidationException {
    public InvalidDirectorAcademicContextException(){
        super("Director must have both faculty and career.");
    }
}
