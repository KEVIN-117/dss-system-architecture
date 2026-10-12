package uatf.dss.authservice.application.port.in;

import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;

public interface SetUserAcademicContextsUseCase {
    List<UserAcademicContext> execute(SetUserAcademicContextsCommand command);
}
