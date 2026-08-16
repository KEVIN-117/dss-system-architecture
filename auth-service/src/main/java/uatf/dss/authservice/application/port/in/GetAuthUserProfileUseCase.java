package uatf.dss.authservice.application.port.in;

public interface GetAuthUserProfileUseCase {
    AuthUserProfile execute(GetAuthUserProfileCommand command);
}
