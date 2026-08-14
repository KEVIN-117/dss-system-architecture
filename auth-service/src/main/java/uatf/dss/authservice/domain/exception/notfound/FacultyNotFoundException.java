package uatf.dss.authservice.domain.exception.notfound;

public class FacultyNotFoundException extends NotFoundException {
    public FacultyNotFoundException(){
        super("The specified faculty does not exist.");
    }
}
