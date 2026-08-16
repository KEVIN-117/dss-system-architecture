package uatf.dss.authservice.application.port.in;

import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;
import java.util.UUID;

public record AuthUserProfile(
        UUID id,
        String username,
        String email,
        String firstName,
        String lastName,
        boolean isActive,
        List<UserAcademicContext> academicContexts
) {
}
