package uatf.dss.authservice.application.port.in;

import java.util.List;

/** Responses of {@link IamClientAdministrationUseCase}. A secret is only ever returned once, right after issuing it. */
public final class IamClientViews {

    private IamClientViews() {
    }

    public enum ClientKind {
        PUBLIC,
        CONFIDENTIAL,
        /** Only validates tokens (no login, no secret in use). */
        BEARER_ONLY
    }

    /**
     * @param system   client the platform depends on: read-only, except {@code dss-bff}, whose name, description and
     *                 URIs can be edited (for new domains) but which cannot be disabled
     */
    public record Client(
            String clientId,
            String name,
            String description,
            ClientKind type,
            boolean enabled,
            boolean standardFlowEnabled,
            boolean serviceAccountsEnabled,
            List<String> redirectUris,
            List<String> webOrigins,
            List<String> postLogoutRedirectUris,
            boolean system) {
    }

    /** Result of creating a client; {@code secret} is set only for confidential clients. */
    public record CreatedClient(Client client, String secret) {
        @Override
        public String toString() {
            return "CreatedClient[client=" + client + ", secret=" + (secret == null ? "null" : "****") + "]";
        }
    }

    public record IssuedSecret(String clientId, String secret) {
        @Override
        public String toString() {
            return "IssuedSecret[clientId=" + clientId + ", secret=****]";
        }
    }
}
