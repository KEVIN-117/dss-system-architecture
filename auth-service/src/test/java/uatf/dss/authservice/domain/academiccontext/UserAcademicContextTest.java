package uatf.dss.authservice.domain.academiccontext;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import uatf.dss.authservice.domain.exception.validation.FacultyRequiredException;
import uatf.dss.authservice.domain.exception.validation.InvalidAcademicContextException;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Feature: AcademicContext - UserAcademicContext Entity Unit Tests")
class UserAcademicContextTest {

    @Test
    @DisplayName("Should instantiate UserAcademicContext successfully when both faculty and career are provided")
    void shouldCreateContextWithFacultyAndCareer() {
        UUID id = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Integer facultyId = 101;
        String careerId = "A01";

        UserAcademicContext context = new UserAcademicContext(id, userId, facultyId, careerId);

        assertNotNull(context);
        assertEquals(id, context.id());
        assertEquals(userId, context.userId());
        assertEquals(facultyId, context.facultyId());
        assertEquals(careerId, context.careerId());
    }

    @Test
    @DisplayName("Should instantiate UserAcademicContext successfully when only faculty is provided (Decano context)")
    void shouldCreateContextWithFacultyOnly() {
        UUID id = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Integer facultyId = 101;

        UserAcademicContext context = new UserAcademicContext(id, userId, facultyId, null);

        assertNotNull(context);
        assertEquals(facultyId, context.facultyId());
        assertNull(context.careerId());
    }

    @Test
    @DisplayName("Should instantiate UserAcademicContext successfully when neither faculty nor career are provided (Global context)")
    void shouldCreateContextWithNoFacultyAndNoCareer() {
        UUID id = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        UserAcademicContext context = new UserAcademicContext(id, userId, null, null);

        assertNotNull(context);
        assertNull(context.facultyId());
        assertNull(context.careerId());
    }

    @Test
    @DisplayName("Should throw FacultyRequiredException when careerId is present but facultyId is null")
    void shouldThrowFacultyRequiredExceptionWhenCareerPresentWithoutFaculty() {
        UUID id = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        assertThrows(FacultyRequiredException.class, () ->
                new UserAcademicContext(id, userId, null, "202")
        );
    }

    @Test
    @DisplayName("Should accept zero and reject negative faculty IDs")
    void shouldAcceptZeroAndRejectNegativeFacultyIds() {
        UUID id = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        UserAcademicContext zeroFacultyContext = new UserAcademicContext(id, userId, 0, null);
        assertEquals(0, zeroFacultyContext.facultyId());

        assertThrows(InvalidAcademicContextException.class, () ->
                new UserAcademicContext(id, userId, -5, null)
        );
    }

    @Test
    @DisplayName("Should throw InvalidAcademicContextException when careerId is not a three-character code")
    void shouldThrowInvalidAcademicContextExceptionWhenCareerIdHasInvalidFormat() {
        UUID id = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        assertThrows(InvalidAcademicContextException.class, () ->
                new UserAcademicContext(id, userId, 10, "0")
        );
        assertThrows(InvalidAcademicContextException.class, () ->
                new UserAcademicContext(id, userId, 10, "-3")
        );
    }
}
