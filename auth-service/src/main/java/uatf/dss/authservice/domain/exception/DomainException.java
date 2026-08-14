package uatf.dss.authservice.domain.exception;

public abstract class DomainException extends RuntimeException{
    public DomainException(String message){
        super(message);
    }

    public abstract int getHttpStatus();
}
