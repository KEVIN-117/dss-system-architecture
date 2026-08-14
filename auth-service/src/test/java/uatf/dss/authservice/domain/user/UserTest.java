package uatf.dss.authservice.domain.user;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import uatf.dss.authservice.domain.exception.validation.InvalidEmailException;
import uatf.dss.authservice.domain.exception.validation.InvalidUsernameException;
import uatf.dss.authservice.domain.model.Email;
import uatf.dss.authservice.domain.model.User;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Feature: User - Domain Model Unit Tests")
class UserTest {

    @Test
    @DisplayName("Should create User entity successfully with User.create factory method")
    void shouldCreateUserViaFactoryMethod() {
        UUID id = UUID.randomUUID();
        UUID keycloakId = UUID.randomUUID();
        String username = "krodriguez";
        String emailStr = "krodriguez@uatf.edu.bo";
        String firstName = "Kevin";
        String lastName = "Rodriguez";

        User user = User.create(id, keycloakId, username, emailStr, firstName, lastName, true);

        assertNotNull(user);
        assertEquals(id, user.id());
        assertEquals(keycloakId, user.keycloakId());
        assertEquals(username, user.username());
        assertEquals(emailStr, user.email().email());
        assertEquals(firstName, user.firstName());
        assertEquals(lastName, user.lastName());
        assertTrue(user.isActive());
    }

    @Test
    @DisplayName("Should create User entity successfully via canonical constructor with Email VO")
    void shouldCreateUserViaCanonicalConstructor() {
        UUID id = UUID.randomUUID();
        UUID keycloakId = UUID.randomUUID();
        Email email = new Email("krodriguez@uatf.edu.bo");

        User user = new User(id, keycloakId, "krodriguez", email, "Kevin", "Rodriguez", false);

        assertNotNull(user);
        assertEquals(id, user.id());
        assertEquals(keycloakId, user.keycloakId());
        assertEquals("krodriguez", user.username());
        assertEquals(email, user.email());
        assertFalse(user.isActive());
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "\t", "\n"})
    @DisplayName("Should throw InvalidUsernameException when username is null or blank in User.create")
    void shouldThrowInvalidUsernameExceptionWhenUsernameIsBlank(String invalidUsername) {
        UUID id = UUID.randomUUID();
        UUID keycloakId = UUID.randomUUID();

        assertThrows(InvalidUsernameException.class, () ->
                User.create(id, keycloakId, invalidUsername, "krodriguez@uatf.edu.bo", "Kevin", "Rodriguez", true)
        );
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"invalid-email", "@no-user.com", "user@"})
    @DisplayName("Should throw InvalidEmailException when email is invalid in User.create")
    void shouldThrowInvalidEmailExceptionWhenEmailIsInvalid(String invalidEmail) {
        UUID id = UUID.randomUUID();
        UUID keycloakId = UUID.randomUUID();

        assertThrows(InvalidEmailException.class, () ->
                User.create(id, keycloakId, "krodriguez", invalidEmail, "Kevin", "Rodriguez", true)
        );
    }
}
