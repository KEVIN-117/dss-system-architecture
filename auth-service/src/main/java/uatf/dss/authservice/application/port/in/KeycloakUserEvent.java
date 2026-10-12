package uatf.dss.authservice.application.port.in;

import java.util.List;
import java.util.UUID;

public record KeycloakUserEvent(
        String eventId,
        String realmId,
        String eventType,
        long timestamp,
        UserSnapshot user) {

    public record UserSnapshot(
            UUID keycloakId,
            String username,
            String email,
            String firstName,
            String lastName,
            boolean isActive,
            List<RoleSnapshot> roles) {
        public UserSnapshot {
            roles = roles == null ? null : List.copyOf(roles);
        }
    }

    public record RoleSnapshot(
            String id,
            String name,
            String description,
            boolean clientRole,
            String containerId) {}
}
