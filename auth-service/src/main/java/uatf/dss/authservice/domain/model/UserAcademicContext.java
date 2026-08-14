package uatf.dss.authservice.domain.model;

import uatf.dss.authservice.domain.exception.validation.FacultyRequiredException;
import uatf.dss.authservice.domain.exception.validation.InvalidAcademicContextException;

import java.util.UUID;

public record UserAcademicContext(
        UUID id,
        UUID userId,
        Integer facultyId,
        Integer careerId
) {
    public UserAcademicContext {
        if (facultyId != null && facultyId <= 0) {
            throw new InvalidAcademicContextException("Faculty ID must be a positive integer.");
        }
        if (careerId != null && careerId <= 0) {
            throw new InvalidAcademicContextException("Career ID must be a positive integer.");
        }
        if (careerId != null && facultyId == null) {
            throw new FacultyRequiredException("A faculty must be defined when assigning a career.");
        }
    }
}
