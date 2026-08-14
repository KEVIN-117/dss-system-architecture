package uatf.dss.authservice.domain.model;

import uatf.dss.authservice.domain.exception.InvalidUsernameException;

import java.util.UUID;

public record User(
    UUID id,
    UUID keycloakId,
    String username,
    Email email,
    String firstName,
    String lastName,
    boolean isActive
) {
    public static User create(UUID id, UUID keycloakId, String username, String email, String firstName, String lastName, boolean isActive) {
        if (username == null || username.isBlank()) {
            throw new InvalidUsernameException("The username provided is invalid or not allowed.");
        }
        return new User(id, keycloakId, username, new Email(email), firstName, lastName, isActive);
    }
}
