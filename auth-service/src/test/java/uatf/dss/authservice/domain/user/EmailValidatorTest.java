package uatf.dss.authservice.domain.user;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import uatf.dss.authservice.shared.EmailValidator;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Feature: User - EmailValidator Unit Tests")
class EmailValidatorTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "test@uatf.edu.bo",
            "krodriguez@gmail.com",
            "first.last@domain.co",
            "user+alias@sub.domain.org"
    })
    @DisplayName("Should return true for valid email formats")
    void shouldReturnTrueForValidEmail(String validEmail) {
        assertTrue(EmailValidator.isValid(validEmail));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "",
            "   ",
            "plainaddress",
            "#@%^%#$@#$@#.com",
            "@domain.com",
            "Joe Smith <email@domain.com>",
            "email.domain.com",
            "email@domain@domain.com",
            "email@domain..com"
    })
    @DisplayName("Should return false for invalid email formats")
    void shouldReturnFalseForInvalidEmail(String invalidEmail) {
        assertFalse(EmailValidator.isValid(invalidEmail));
    }

    @Test
    @DisplayName("Should return false for null email")
    void shouldReturnFalseForNullEmail() {
        assertFalse(EmailValidator.isValid(null));
    }
}
