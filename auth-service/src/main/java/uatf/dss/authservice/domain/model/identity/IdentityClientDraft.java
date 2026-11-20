package uatf.dss.authservice.domain.model.identity;

import java.util.List;

/**
 * Data to create or update a client. On update a {@code null} field means "leave unchanged";
 * {@code clientId} identifies the client and is not changed. New clients never get the implicit or password
 * grants, and public clients require PKCE (S256).
 */
public record IdentityClientDraft(
        String clientId,
        String name,
        String description,
        Boolean enabled,
        Boolean publicClient,
        Boolean standardFlowEnabled,
        Boolean serviceAccountsEnabled,
        List<String> redirectUris,
        List<String> webOrigins,
        List<String> postLogoutRedirectUris) {
}
