package uatf.dss.authservice.domain.academiccontext;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import uatf.dss.authservice.domain.exception.validation.InvalidAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidDeanAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidDirectorAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidRectorAcademicContextException;
import uatf.dss.authservice.domain.model.RoleType;
import uatf.dss.authservice.domain.model.UserAcademicContext;
import uatf.dss.authservice.domain.validator.AcademicContextValidator;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, "020");

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
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, "020");

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
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, "020");

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

    @Nested
    @DisplayName("Several contexts per user (IAM-009)")
    class MultipleContexts {

        private UserAcademicContext context(Integer facultyId, String careerId) {
            return new UserAcademicContext(null, dummyUserId, facultyId, careerId);
        }

        @Test
        @DisplayName("A dean can hold several faculties and a director several careers")
        void deanAndDirectorAcceptSeveralContexts() {
            assertDoesNotThrow(() -> AcademicContextValidator.validateAll(
                    List.of(context(5, null), context(8, null)), RoleType.DECANO));
            assertDoesNotThrow(() -> AcademicContextValidator.validateAll(
                    List.of(context(10, "025"), context(10, "026"), context(8, "015")), RoleType.DIRECTOR));
        }

        @Test
        @DisplayName("Global roles take no context; dean and director need at least one")
        void countRules() {
            assertDoesNotThrow(() -> AcademicContextValidator.validateAll(List.of(), RoleType.RECTOR));
            assertDoesNotThrow(() -> AcademicContextValidator.validateAll(List.of(), RoleType.SUPERADMIN));
            assertThrows(InvalidAcademicContextException.class, () ->
                    AcademicContextValidator.validateAll(List.of(context(5, null)), RoleType.RECTOR));
            assertThrows(InvalidAcademicContextException.class, () ->
                    AcademicContextValidator.validateAll(List.of(), RoleType.DECANO));
            assertThrows(InvalidAcademicContextException.class, () ->
                    AcademicContextValidator.validateAll(List.of(), RoleType.DIRECTOR));
        }

        @Test
        @DisplayName("Duplicates are rejected")
        void duplicatesAreRejected() {
            InvalidAcademicContextException dean = assertThrows(InvalidAcademicContextException.class, () ->
                    AcademicContextValidator.validateAll(List.of(context(5, null), context(5, null)), RoleType.DECANO));
            assertTrue(dean.getMessage().contains("faculty 5"));
            InvalidAcademicContextException director = assertThrows(InvalidAcademicContextException.class, () ->
                    AcademicContextValidator.validateAll(
                            List.of(context(10, "025"), context(8, "015"), context(10, "025")), RoleType.DIRECTOR));
            assertTrue(director.getMessage().contains("career 025"));
        }

        @Test
        @DisplayName("Each context keeps the shape rule of the role")
        void everyContextKeepsTheShapeRule() {
            assertThrows(InvalidDeanAcademicContextException.class, () -> AcademicContextValidator.validateAll(
                    List.of(context(5, null), context(10, "025")), RoleType.DECANO));
            assertThrows(InvalidDirectorAcademicContextException.class, () -> AcademicContextValidator.validateAll(
                    List.of(context(10, "025"), context(8, null)), RoleType.DIRECTOR));
        }

        @Test
        @DisplayName("At most MAX_CONTEXTS contexts")
        void upperBound() {
            List<UserAcademicContext> max = IntStream.range(0, AcademicContextValidator.MAX_CONTEXTS)
                    .mapToObj(i -> context(i, null)).toList();
            assertDoesNotThrow(() -> AcademicContextValidator.validateAll(max, RoleType.DECANO));
            List<UserAcademicContext> tooMany = IntStream.rangeClosed(0, AcademicContextValidator.MAX_CONTEXTS)
                    .mapToObj(i -> context(i, null)).toList();
            assertThrows(InvalidAcademicContextException.class, () ->
                    AcademicContextValidator.validateAll(tooMany, RoleType.DECANO));
        }
    }
}
