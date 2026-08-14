package uatf.dss.authservice.domain.exception;

public class CareerNotFoundException extends RuntimeException{
    public CareerNotFoundException(){
        super("The specified career does not exist.");
    }
}
