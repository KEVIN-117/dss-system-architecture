package uatf.dss.authservice.domain.model.identity;

import java.util.List;

/** An application registered in the identity provider. {@code id} is the internal id, {@code clientId} the public one. */
public record IdentityClient(
        String id,
        String clientId,
        String name,
        String description,
        boolean enabled,
        boolean publicClient,
        boolean bearerOnly,
        boolean standardFlowEnabled,
        boolean serviceAccountsEnabled,
        List<String> redirectUris,
        List<String> webOrigins,
        List<String> postLogoutRedirectUris) {

    public IdentityClient {
        redirectUris = redirectUris == null ? List.of() : List.copyOf(redirectUris);
        webOrigins = webOrigins == null ? List.of() : List.copyOf(webOrigins);
        postLogoutRedirectUris = postLogoutRedirectUris == null ? List.of() : List.copyOf(postLogoutRedirectUris);
    }
}
