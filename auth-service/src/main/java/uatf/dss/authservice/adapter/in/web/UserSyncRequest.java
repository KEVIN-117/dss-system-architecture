package uatf.dss.authservice.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record UserSyncRequest(
    @NotBlank String eventId,
    @NotBlank String realmId,
    @NotBlank String eventType,
    long timestamp,
    @NotNull @Valid UserDto user
) {
    public record UserDto(
        @NotNull UUID keycloakId,
        @NotBlank String username,
        @NotBlank String email,
        @NotBlank String firstName,
        @NotBlank String lastName,
        boolean isActive
    ) {}
}
