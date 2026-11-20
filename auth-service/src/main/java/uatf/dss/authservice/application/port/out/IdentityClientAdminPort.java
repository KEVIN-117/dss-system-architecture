package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.identity.IdentityClient;
import uatf.dss.authservice.domain.model.identity.IdentityClientDraft;

import java.util.List;
import java.util.Optional;

/** Manages applications (clients) in the identity provider, addressed by their public {@code clientId}. */
public interface IdentityClientAdminPort {

    /** {@code clientIdSearch == null} lists every client; otherwise a case-insensitive substring match. */
    List<IdentityClient> listClients(String clientIdSearch, int first, int max);

    Optional<IdentityClient> findClient(String clientId);

    /** @return the internal id of the new client */
    String createClient(IdentityClientDraft client);

    void updateClient(String clientId, IdentityClientDraft changes);

    /** Generates a new secret for a confidential client and returns it. Callers must never log or persist it. */
    String regenerateClientSecret(String clientId);
}
