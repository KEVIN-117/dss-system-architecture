package uatf.dss.authservice.domain.user;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import uatf.dss.authservice.domain.exception.InvalidEmailException;
import uatf.dss.authservice.domain.model.Email;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Feature: User - Email Value Object Unit Tests")
class EmailTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "valid.user@uatf.edu.bo",
            "admin@domain.com",
            "developer.test+tag@institution.edu"
    })
    @DisplayName("Should create Email object successfully when email format is valid")
    void shouldCreateEmailWhenValid(String validEmailStr) {
        Email email = new Email(validEmailStr);
        assertNotNull(email);
        assertEquals(validEmailStr, email.email());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "invalid-email",
            "@missing-local-part.com",
            "missing-at-sign.com",
            "",
            "   "
    })
    @DisplayName("Should throw InvalidEmailException when email format is invalid")
    void shouldThrowInvalidEmailExceptionWhenInvalid(String invalidEmailStr) {
        assertThrows(InvalidEmailException.class, () -> new Email(invalidEmailStr));
    }

    @Test
    @DisplayName("Should throw InvalidEmailException when email is null")
    void shouldThrowInvalidEmailExceptionWhenNull() {
        assertThrows(InvalidEmailException.class, () -> new Email(null));
    }

    @Test
    @DisplayName("Should adhere to value object equality")
    void shouldAdhereToEquality() {
        Email email1 = new Email("user@uatf.edu.bo");
        Email email2 = new Email("user@uatf.edu.bo");
        Email email3 = new Email("other@uatf.edu.bo");

        assertEquals(email1, email2);
        assertEquals(email1.hashCode(), email2.hashCode());
        assertNotEquals(email1, email3);
    }
}
