package uatf.dss.authservice.domain.model;

import uatf.dss.authservice.domain.exception.FacultyRequiredException;

import java.util.UUID;

public record UserAcademicContext(
        UUID id,
        UUID userId,
        Integer facultyId,
        Integer careerId
) {
    public UserAcademicContext {
        if (careerId != null && facultyId == null) {
            throw new FacultyRequiredException("A faculty must be defined when assigning a career.");
        }
    }
}
