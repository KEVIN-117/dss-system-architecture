package uatf.dss.authservice.domain.exception;

public class FacultyNotFoundException extends RuntimeException{
    public FacultyNotFoundException(){
        super("The specified faculty does not exist.");
    }
}
