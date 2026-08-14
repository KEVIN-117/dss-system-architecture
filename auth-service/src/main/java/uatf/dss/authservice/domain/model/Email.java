package uatf.dss.authservice.domain.model;

import uatf.dss.authservice.domain.exception.validation.InvalidEmailException;
import uatf.dss.authservice.shared.EmailValidator;

public record Email(String email) {
    public Email {
        if (email == null || email.isBlank()) {
            throw new InvalidEmailException("Email cannot be null or blank.");
        }
        email = email.trim().toLowerCase();
        if (!EmailValidator.isValid(email)){
            throw new InvalidEmailException("Invalid email format.");
        }
    }
    @Override
    public String toString() {
        return this.email;
    }
}