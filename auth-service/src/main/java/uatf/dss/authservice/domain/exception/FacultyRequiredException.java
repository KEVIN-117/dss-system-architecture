package uatf.dss.authservice.domain.exception;

public class FacultyRequiredException extends RuntimeException{
    public FacultyRequiredException(){
        super("A faculty must be defined when assigning a career.");
    }

    public FacultyRequiredException(String message){
        super(message);
    }
}
