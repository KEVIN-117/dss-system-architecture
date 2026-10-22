package uatf.dss.authservice.domain.model;

import uatf.dss.authservice.domain.exception.validation.FacultyRequiredException;
import uatf.dss.authservice.domain.exception.validation.InvalidAcademicContextException;

import java.util.UUID;

public record UserAcademicContext(
        UUID id,
        UUID userId,
        Integer facultyId,
        String careerId
) {
    public UserAcademicContext {
        if (facultyId != null && facultyId < 0) {
            throw new InvalidAcademicContextException("Faculty ID must be a non-negative integer.");
        }
        if (careerId != null && (careerId.length() != 3 || careerId.isBlank() || !careerId.equals(careerId.trim()))) {
            throw new InvalidAcademicContextException("Career ID must be a three-character code without surrounding whitespace.");
        }
        if (careerId != null && facultyId == null) {
            throw new FacultyRequiredException("A faculty must be defined when assigning a career.");
        }
    }
}
