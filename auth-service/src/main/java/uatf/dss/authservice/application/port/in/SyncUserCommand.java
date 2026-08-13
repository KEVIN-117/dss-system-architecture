package uatf.dss.authservice.application.port.in;

import java.util.UUID;

public record SyncUserCommand(
    UUID keycloakId,
    String username,
    String email,
    String firstName,
    String lastName,
    boolean isActive
) {}
