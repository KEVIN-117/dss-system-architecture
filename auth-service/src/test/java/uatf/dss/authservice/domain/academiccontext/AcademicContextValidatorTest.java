package uatf.dss.authservice.domain.academiccontext;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import uatf.dss.authservice.domain.exception.validation.InvalidAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidDeanAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidDirectorAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidRectorAcademicContextException;
import uatf.dss.authservice.domain.model.AcademicScope;
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
    @DisplayName("Scope: GLOBAL and NONE (no context)")
    class GlobalAndNoneRules {

        @Test
        @DisplayName("Should pass validation when both facultyId and careerId are null")
        void shouldPassWhenContextIsEmpty() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, null, null);

            assertDoesNotThrow(() -> AcademicContextValidator.validate(context, AcademicScope.GLOBAL));
            assertDoesNotThrow(() -> AcademicContextValidator.validate(context, AcademicScope.NONE));
        }

        @Test
        @DisplayName("Should throw InvalidRectorAcademicContextException when facultyId is present")
        void shouldThrowWhenFacultyIsPresent() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, null);

            assertThrows(InvalidRectorAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, AcademicScope.GLOBAL));
            assertThrows(InvalidRectorAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, AcademicScope.NONE));
        }

        @Test
        @DisplayName("Should throw InvalidRectorAcademicContextException when both facultyId and careerId are present")
        void shouldThrowWhenBothArePresent() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, "020");

            assertThrows(InvalidRectorAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, AcademicScope.GLOBAL));
            assertThrows(InvalidRectorAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, AcademicScope.NONE));
        }
    }

    @Nested
    @DisplayName("Scope: FACULTY (analytics:faculty)")
    class FacultyRules {

        @Test
        @DisplayName("Should pass validation when facultyId is present and careerId is null")
        void shouldPassWhenFacultyPresentAndNoCareer() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, null);

            assertDoesNotThrow(() -> AcademicContextValidator.validate(context, AcademicScope.FACULTY));
        }

        @Test
        @DisplayName("Should throw InvalidDeanAcademicContextException when facultyId is null")
        void shouldThrowWhenFacultyIsNull() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, null, null);

            assertThrows(InvalidDeanAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, AcademicScope.FACULTY));
        }

        @Test
        @DisplayName("Should throw InvalidDeanAcademicContextException when careerId is present")
        void shouldThrowWhenCareerIsPresent() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, "020");

            assertThrows(InvalidDeanAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, AcademicScope.FACULTY));
        }
    }

    @Nested
    @DisplayName("Scope: CAREER (analytics:career)")
    class CareerRules {

        @Test
        @DisplayName("Should pass validation when both facultyId and careerId are present")
        void shouldPassWhenBothFacultyAndCareerPresent() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, "020");

            assertDoesNotThrow(() -> AcademicContextValidator.validate(context, AcademicScope.CAREER));
        }

        @Test
        @DisplayName("Should throw InvalidDirectorAcademicContextException when careerId is null")
        void shouldThrowWhenCareerIsNull() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, 10, null);

            assertThrows(InvalidDirectorAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, AcademicScope.CAREER));
        }

        @Test
        @DisplayName("Should throw InvalidDirectorAcademicContextException when facultyId and careerId are both null")
        void shouldThrowWhenBothAreNull() {
            UserAcademicContext context = new UserAcademicContext(dummyId, dummyUserId, null, null);

            assertThrows(InvalidDirectorAcademicContextException.class, () ->
                    AcademicContextValidator.validate(context, AcademicScope.CAREER));
        }
    }

    @Nested
    @DisplayName("Several contexts per user (IAM-009)")
    class MultipleContexts {

        private UserAcademicContext context(Integer facultyId, String careerId) {
            return new UserAcademicContext(null, dummyUserId, facultyId, careerId);
        }

        @Test
        @DisplayName("FACULTY can hold several faculties and CAREER several careers")
        void deanAndDirectorAcceptSeveralContexts() {
            assertDoesNotThrow(() -> AcademicContextValidator.validateAll(
                    List.of(context(5, null), context(8, null)), AcademicScope.FACULTY));
            assertDoesNotThrow(() -> AcademicContextValidator.validateAll(
                    List.of(context(10, "025"), context(10, "026"), context(8, "015")), AcademicScope.CAREER));
        }

        @Test
        @DisplayName("GLOBAL and NONE take no context; FACULTY and CAREER need at least one")
        void countRules() {
            assertDoesNotThrow(() -> AcademicContextValidator.validateAll(List.of(), AcademicScope.GLOBAL));
            assertDoesNotThrow(() -> AcademicContextValidator.validateAll(List.of(), AcademicScope.NONE));
            assertThrows(InvalidAcademicContextException.class, () ->
                    AcademicContextValidator.validateAll(List.of(context(5, null)), AcademicScope.GLOBAL));
            InvalidAcademicContextException none = assertThrows(InvalidAcademicContextException.class, () ->
                    AcademicContextValidator.validateAll(List.of(context(5, null)), AcademicScope.NONE));
            assertTrue(none.getMessage().contains("no faculty/career analytics permission"));
            assertThrows(InvalidAcademicContextException.class, () ->
                    AcademicContextValidator.validateAll(List.of(), AcademicScope.FACULTY));
            assertThrows(InvalidAcademicContextException.class, () ->
                    AcademicContextValidator.validateAll(List.of(), AcademicScope.CAREER));
        }

        @Test
        @DisplayName("Duplicates are rejected")
        void duplicatesAreRejected() {
            InvalidAcademicContextException dean = assertThrows(InvalidAcademicContextException.class, () ->
                    AcademicContextValidator.validateAll(List.of(context(5, null), context(5, null)), AcademicScope.FACULTY));
            assertTrue(dean.getMessage().contains("faculty 5"));
            InvalidAcademicContextException director = assertThrows(InvalidAcademicContextException.class, () ->
                    AcademicContextValidator.validateAll(
                            List.of(context(10, "025"), context(8, "015"), context(10, "025")), AcademicScope.CAREER));
            assertTrue(director.getMessage().contains("career 025"));
        }

        @Test
        @DisplayName("Each context keeps the shape rule of the scope")
        void everyContextKeepsTheShapeRule() {
            assertThrows(InvalidDeanAcademicContextException.class, () -> AcademicContextValidator.validateAll(
                    List.of(context(5, null), context(10, "025")), AcademicScope.FACULTY));
            assertThrows(InvalidDirectorAcademicContextException.class, () -> AcademicContextValidator.validateAll(
                    List.of(context(10, "025"), context(8, null)), AcademicScope.CAREER));
        }

        @Test
        @DisplayName("At most MAX_CONTEXTS contexts")
        void upperBound() {
            List<UserAcademicContext> max = IntStream.range(0, AcademicContextValidator.MAX_CONTEXTS)
                    .mapToObj(i -> context(i, null)).toList();
            assertDoesNotThrow(() -> AcademicContextValidator.validateAll(max, AcademicScope.FACULTY));
            List<UserAcademicContext> tooMany = IntStream.rangeClosed(0, AcademicContextValidator.MAX_CONTEXTS)
                    .mapToObj(i -> context(i, null)).toList();
            assertThrows(InvalidAcademicContextException.class, () ->
                    AcademicContextValidator.validateAll(tooMany, AcademicScope.FACULTY));
        }
    }
}
