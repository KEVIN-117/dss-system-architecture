package uatf.dss.authservice.application.port.in;

import uatf.dss.authservice.domain.model.audit.AuditActor;

import java.util.List;

/** Commands of {@link IamClientAdministrationUseCase}. Clients are addressed by their public {@code clientId}. */
public final class IamClientCommands {

    private IamClientCommands() {
    }

    public enum ClientType {
        /** Browser or mobile app: no secret, authorization code + PKCE. */
        PUBLIC,
        /** Server-side app or service: authenticates with a secret. */
        CONFIDENTIAL
    }

    public record CreateClient(
            AuditActor actor,
            String clientId,
            String name,
            String description,
            ClientType type,
            boolean enabled,
            boolean serviceAccountsEnabled,
            List<String> redirectUris,
            List<String> webOrigins,
            List<String> postLogoutRedirectUris) {
    }

    /** {@code null} leaves a field unchanged. The type and the clientId cannot change. */
    public record UpdateClient(
            AuditActor actor,
            String clientId,
            String name,
            String description,
            Boolean enabled,
            List<String> redirectUris,
            List<String> webOrigins,
            List<String> postLogoutRedirectUris) {
    }

    public record RotateSecret(AuditActor actor, String clientId) {
    }
}
