package uatf.dss.authservice.domain.model;

import java.util.UUID;

public record User(
    UUID id,
    UUID keycloakId,
    String username,
    String email,
    String firstName,
    String lastName,
    boolean isActive
) {}
