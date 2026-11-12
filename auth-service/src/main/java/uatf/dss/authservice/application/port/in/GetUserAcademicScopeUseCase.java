package uatf.dss.authservice.application.port.in;

public interface GetUserAcademicScopeUseCase {
    UserAcademicScope execute(GetUserAcademicScopeCommand command);
}
