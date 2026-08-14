package uatf.dss.authservice.domain.exception.notfound;

public class CareerNotFoundException extends NotFoundException {
    public CareerNotFoundException(){
        super("The specified career does not exist.");
    }
}
