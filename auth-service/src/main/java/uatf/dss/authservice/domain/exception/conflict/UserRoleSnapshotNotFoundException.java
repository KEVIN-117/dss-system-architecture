package uatf.dss.authservice.domain.exception.conflict;

public class UserRoleSnapshotNotFoundException extends ConflictException {
    public UserRoleSnapshotNotFoundException() {
        super("El usuario aún no tiene una réplica de rol reconocida sincronizada desde Keycloak.");
    }
}
