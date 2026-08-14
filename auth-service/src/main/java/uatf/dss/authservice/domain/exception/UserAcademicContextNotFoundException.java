package uatf.dss.authservice.domain.exception;

public class UserAcademicContextNotFoundException extends RuntimeException{
    public UserAcademicContextNotFoundException(){
        super("No academic context found for this user.");
    }
}
