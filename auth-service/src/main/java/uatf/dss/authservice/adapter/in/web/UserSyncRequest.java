package uatf.dss.authservice.adapter.in.web;

import java.util.UUID;

public record UserSyncRequest(
    String eventId,
    String realmId,
    String eventType,
    long timestamp,
    UserDto user
) {
    public record UserDto(
        UUID keycloakId,
        String username,
        String email,
        String firstName,
        String lastName,
        boolean isActive
    ) {}
}
