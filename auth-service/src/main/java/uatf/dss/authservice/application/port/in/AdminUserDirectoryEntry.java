package uatf.dss.authservice.application.port.in;

import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;
import java.util.UUID;

/** Safe administrative user view. Authentication provider identifiers and credentials are intentionally omitted. */
public record AdminUserDirectoryEntry(
        UUID id,
        String username,
        String email,
        String firstName,
        String lastName,
        boolean isActive,
        List<String> roles,
        List<UserAcademicContext> academicContexts) {
}
