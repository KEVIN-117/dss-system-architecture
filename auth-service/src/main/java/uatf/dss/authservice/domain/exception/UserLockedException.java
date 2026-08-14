package uatf.dss.authservice.domain.exception;

public class UserLockedException extends RuntimeException{
    public UserLockedException(){
        super("This account is locked due to multiple failed attempts.");
    }
}
