package uatf.dss.authservice.domain.model.audit;

/**
 * Who performed an administrative operation: the Keycloak subject and username taken from the JWT, and the client
 * IP as resolved behind the reverse proxy. Any field may be {@code null} for system-initiated operations.
 */
public record AuditActor(String keycloakId, String username, String ipAddress) {

    public static final AuditActor SYSTEM = new AuditActor(null, "system", null);
}
