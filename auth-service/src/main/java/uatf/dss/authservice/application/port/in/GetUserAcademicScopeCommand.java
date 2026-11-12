package uatf.dss.authservice.application.port.in;

import java.util.Objects;
import java.util.UUID;

/** Looks up a user's academic scope by Keycloak subject (the JWT {@code sub}). */
public record GetUserAcademicScopeCommand(UUID keycloakId) {
    public GetUserAcademicScopeCommand {
        Objects.requireNonNull(keycloakId, "keycloakId");
    }
}
