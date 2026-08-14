package uatf.dss.authservice.domain.academiccontext;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import uatf.dss.authservice.domain.exception.validation.InvalidDeanAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidDirectorAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidRectorAcademicContextException;
import uatf.dss.authservice.domain.model.RoleType;
import uatf.dss.authservice.domain.model.UserAcademicContext;
import uatf.dss.authservice.domain.validator.AcademicContextValidator;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

@DisplayName("Feature: AcademicContext - Validator Unit Tests (RNF4.1 Segregation Rules)")
class AcademicContextValidatorTest {

    private final UUID dummyId = UUID.randomUUID();
    private final UUID dummyUserId = UUID.randomUUID();

    @Nested
    @DisplayName("Role: RECTOR and SUPERADMIN (Global Scope)")
    class RectorAndSuperadminRules {

        @Test
        @DisplayName("Should pass validation when both facultyId and careerId are null")
        void shouldPassWhenContextIsEmpty() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, null, null);

            assertDoesNotThrow(() -> AcademicContextValidator.validate(context, RoleType.RECTOR));
            assertDoesNotThrow(() -> AcademicContextValidator.validate(context, RoleType.SUPERADMIN));
        }

        @Test
        @DisplayName("Should throw InvalidRectorAcademicContextException when facultyId is present")
        void shouldThrowWhenFacultyIsPresent() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, null);

            assertThrows(InvalidRectorAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, RoleType.RECTOR));
            assertThrows(InvalidRectorAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, RoleType.SUPERADMIN));
        }

        @Test
        @DisplayName("Should throw InvalidRectorAcademicContextException when both facultyId and careerId are present")
        void shouldThrowWhenBothArePresent() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, 20);

            assertThrows(InvalidRectorAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, RoleType.RECTOR));
            assertThrows(InvalidRectorAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, RoleType.SUPERADMIN));
        }
    }

    @Nested
    @DisplayName("Role: DECANO (Faculty Scope)")
    class DecanoRules {

        @Test
        @DisplayName("Should pass validation when facultyId is present and careerId is null")
        void shouldPassWhenFacultyPresentAndNoCareer() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, null);

            assertDoesNotThrow(() -> AcademicContextValidator.validate(context, RoleType.DECANO));
        }

        @Test
        @DisplayName("Should throw InvalidDeanAcademicContextException when facultyId is null")
        void shouldThrowWhenFacultyIsNull() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, null, null);

            assertThrows(InvalidDeanAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, RoleType.DECANO));
        }

        @Test
        @DisplayName("Should throw InvalidDeanAcademicContextException when careerId is present")
        void shouldThrowWhenCareerIsPresent() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, 20);

            assertThrows(InvalidDeanAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, RoleType.DECANO));
        }
    }

    @Nested
    @DisplayName("Role: DIRECTOR (Career Scope)")
    class DirectorRules {

        @Test
        @DisplayName("Should pass validation when both facultyId and careerId are present")
        void shouldPassWhenBothFacultyAndCareerPresent() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, 20);

            assertDoesNotThrow(() -> AcademicContextValidator.validate(context, RoleType.DIRECTOR));
        }

        @Test
        @DisplayName("Should throw InvalidDirectorAcademicContextException when careerId is null")
        void shouldThrowWhenCareerIsNull() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, null);

            assertThrows(InvalidDirectorAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, RoleType.DIRECTOR));
        }

        @Test
        @DisplayName("Should throw InvalidDirectorAcademicContextException when facultyId and careerId are both null")
        void shouldThrowWhenBothAreNull() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, null, null);

            assertThrows(InvalidDirectorAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, RoleType.DIRECTOR));
        }
    }
}
