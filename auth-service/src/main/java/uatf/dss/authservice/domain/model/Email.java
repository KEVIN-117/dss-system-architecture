package uatf.dss.authservice.domain.model;

import uatf.dss.authservice.domain.exception.InvalidEmailException;
import uatf.dss.authservice.shared.EmailValidator;

public record Email(String email) {
    public Email {
        if (!EmailValidator.isValid(email)){
            throw new InvalidEmailException("Invalid email format.");
        }
    }
    @Override
    public String toString() {
        return this.email;
    }
}