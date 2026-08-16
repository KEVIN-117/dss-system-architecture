package uatf.dss.authservice.application.port.in;

import java.util.UUID;

public record GetAuthUserProfileCommand(UUID keycloakId) {}
