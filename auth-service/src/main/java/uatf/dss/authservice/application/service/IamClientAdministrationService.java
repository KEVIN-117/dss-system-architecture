package uatf.dss.authservice.application.service;

import uatf.dss.authservice.application.port.in.IamClientAdministrationUseCase;
import uatf.dss.authservice.application.port.in.IamClientCommands;
import uatf.dss.authservice.application.port.in.IamClientViews;
import uatf.dss.authservice.application.port.out.IdentityClientAdminPort;
import uatf.dss.authservice.domain.exception.conflict.IamRuleViolationException;
import uatf.dss.authservice.domain.exception.notfound.IdentityResourceNotFoundException;
import uatf.dss.authservice.domain.exception.validation.ValidationException;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;
import uatf.dss.authservice.domain.model.identity.IdentityClient;
import uatf.dss.authservice.domain.model.identity.IdentityClientDraft;
import uatf.dss.authservice.domain.validator.ClientUriPolicy;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;

/**
 * Implements {@link IamClientAdministrationUseCase} on {@link IdentityClientAdminPort}. Rules:
 * <ul>
 *     <li>System clients are read-only; {@code dss-bff} only allows editing its name, description and URIs (to
 *     deploy on new domains) and can never be disabled. Their secrets are never rotated through the API, because
 *     the services that use them read the secret from their environment.</li>
 *     <li>URIs follow {@link ClientUriPolicy}; HTTPS is required when {@code requireHttps} (production).</li>
 *     <li>New clients: no implicit or password grant, PKCE S256 for public clients; a confidential client gets its
 *     first secret in the creation response.</li>
 *     <li>Secrets are returned once and never reach the audit log (snapshots only record that one was issued).</li>
 * </ul>
 */
public class IamClientAdministrationService implements IamClientAdministrationUseCase {

    public static final String BFF_CLIENT = "dss-bff";
    public static final Set<String> SYSTEM_CLIENTS = Set.of(
            BFF_CLIENT, "uatf-auth-service", "olap-service", "dw-control-service", "dss-permissions",
            "account", "account-console", "admin-cli", "broker", "realm-management", "security-admin-console");
    static final Pattern CLIENT_ID = Pattern.compile("^[a-z][a-z0-9-]{2,63}$");

    private final IdentityClientAdminPort clients;
    private final AdminAuditRecorder audit;
    private final boolean requireHttps;

    public IamClientAdministrationService(IdentityClientAdminPort clients, AdminAuditRecorder audit, boolean requireHttps) {
        this.clients = clients;
        this.audit = audit;
        this.requireHttps = requireHttps;
    }

    @Override
    public List<IamClientViews.Client> listClients(String search, int page, int size) {
        return clients.listClients(search, page * size, size).stream()
                .map(IamClientAdministrationService::view)
                .toList();
    }

    @Override
    public IamClientViews.Client getClient(String clientId) {
        return view(client(clientId));
    }

    @Override
    public IamClientViews.CreatedClient createClient(IamClientCommands.CreateClient command) {
        String clientId = command.clientId() == null ? null : command.clientId().trim();
        boolean isPublic = command.type() == IamClientCommands.ClientType.PUBLIC;
        List<String> redirectUris = clean(command.redirectUris());
        AtomicReference<String> issuedSecret = new AtomicReference<>();

        IdentityClient created = audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "CLIENT_CREATED", AuditTargetType.CLIENT, clientId, null),
                () -> {
                    if (clientId == null || !CLIENT_ID.matcher(clientId).matches()) {
                        throw new ValidationException("clientId inválido: minúsculas, números y guion (3 a 64 "
                                + "caracteres), empezando por una letra, por ejemplo portal-becas.");
                    }
                    if (command.type() == null) {
                        throw new ValidationException("Indica el tipo de cliente: PUBLIC o CONFIDENTIAL.");
                    }
                    if (isPublic && command.serviceAccountsEnabled()) {
                        throw new ValidationException("Un cliente público no puede tener cuenta de servicio.");
                    }
                    if (isPublic && redirectUris.isEmpty()) {
                        throw new ValidationException("Un cliente público necesita al menos una redirect URI.");
                    }
                    validateUris(redirectUris, command.webOrigins(), command.postLogoutRedirectUris());
                    clients.createClient(new IdentityClientDraft(clientId, blankToNull(command.name()),
                            blankToNull(command.description()), command.enabled(), isPublic,
                            isPublic || !redirectUris.isEmpty(), command.serviceAccountsEnabled(), redirectUris,
                            clean(command.webOrigins()), clean(command.postLogoutRedirectUris())));
                    if (!isPublic) {
                        issuedSecret.set(clients.regenerateClientSecret(clientId));
                    }
                    return client(clientId);
                },
                client -> {
                    Map<String, Object> after = snapshot(client);
                    after.put("issuedOnce", issuedSecret.get() != null);
                    return after;
                });
        return new IamClientViews.CreatedClient(view(created), issuedSecret.get());
    }

    @Override
    public IamClientViews.Client updateClient(IamClientCommands.UpdateClient command) {
        String clientId = command.clientId().trim();
        IdentityClient current = client(clientId);
        IdentityClient updated = audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "CLIENT_UPDATED", AuditTargetType.CLIENT, clientId,
                        () -> snapshot(current)),
                () -> {
                    if (SYSTEM_CLIENTS.contains(clientId) && !BFF_CLIENT.equals(clientId)) {
                        throw new IamRuleViolationException("El cliente " + clientId
                                + " es del sistema y solo se puede consultar.");
                    }
                    if (BFF_CLIENT.equals(clientId) && Boolean.FALSE.equals(command.enabled())) {
                        throw new IamRuleViolationException(
                                "No se puede desactivar dss-bff: todos los portales inician sesión con él.");
                    }
                    validateUris(command.redirectUris(), command.webOrigins(), command.postLogoutRedirectUris());
                    clients.updateClient(clientId, new IdentityClientDraft(clientId, blankToNull(command.name()),
                            command.description() == null ? null : command.description().trim(), command.enabled(),
                            null, null, null, cleanOrNull(command.redirectUris()), cleanOrNull(command.webOrigins()),
                            cleanOrNull(command.postLogoutRedirectUris())));
                    return client(clientId);
                },
                IamClientAdministrationService::snapshot);
        return view(updated);
    }

    @Override
    public IamClientViews.IssuedSecret rotateSecret(IamClientCommands.RotateSecret command) {
        String clientId = command.clientId().trim();
        IdentityClient current = client(clientId);
        AtomicReference<String> secret = new AtomicReference<>();
        audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "CLIENT_SECRET_ROTATED", AuditTargetType.CLIENT,
                        clientId, null),
                () -> {
                    if (SYSTEM_CLIENTS.contains(clientId)) {
                        throw new IamRuleViolationException("El secreto de " + clientId + " lo usa un servicio de la "
                                + "plataforma desde su configuración; se rota con el procedimiento de despliegue, no desde aquí.");
                    }
                    if (current.publicClient() || current.bearerOnly()) {
                        throw new ValidationException("El cliente " + clientId + " no usa secreto.");
                    }
                    secret.set(clients.regenerateClientSecret(clientId));
                    return clientId;
                },
                rotated -> Map.of("rotated", true));
        return new IamClientViews.IssuedSecret(clientId, secret.get());
    }

    // ---- helpers -------------------------------------------------------------------------------------------

    private void validateUris(List<String> redirectUris, List<String> webOrigins, List<String> postLogoutUris) {
        ClientUriPolicy.validateRedirectUris(redirectUris, requireHttps, "redirectUris");
        ClientUriPolicy.validateRedirectUris(postLogoutUris, requireHttps, "postLogoutRedirectUris");
        ClientUriPolicy.validateWebOrigins(webOrigins, requireHttps);
    }

    private IdentityClient client(String clientId) {
        String trimmed = clientId == null ? null : clientId.trim();
        return clients.findClient(trimmed).orElseThrow(() ->
                new IdentityResourceNotFoundException("No existe el cliente " + trimmed + "."));
    }

    static IamClientViews.Client view(IdentityClient client) {
        IamClientViews.ClientKind kind = client.bearerOnly() ? IamClientViews.ClientKind.BEARER_ONLY
                : client.publicClient() ? IamClientViews.ClientKind.PUBLIC : IamClientViews.ClientKind.CONFIDENTIAL;
        return new IamClientViews.Client(client.clientId(), client.name(), client.description(), kind,
                client.enabled(), client.standardFlowEnabled(), client.serviceAccountsEnabled(), client.redirectUris(),
                client.webOrigins(), client.postLogoutRedirectUris(), SYSTEM_CLIENTS.contains(client.clientId()));
    }

    /** Audit snapshot: configuration only, never credentials. */
    private static Map<String, Object> snapshot(IdentityClient client) {
        IamClientViews.Client view = view(client);
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("clientId", view.clientId());
        snapshot.put("name", view.name());
        snapshot.put("description", view.description());
        snapshot.put("type", view.type().name());
        snapshot.put("enabled", view.enabled());
        snapshot.put("serviceAccountsEnabled", view.serviceAccountsEnabled());
        snapshot.put("redirectUris", view.redirectUris());
        snapshot.put("webOrigins", view.webOrigins());
        snapshot.put("postLogoutRedirectUris", view.postLogoutRedirectUris());
        return snapshot;
    }

    private static List<String> clean(List<String> values) {
        return values == null ? List.of()
                : values.stream().filter(Objects::nonNull).map(String::trim).filter(v -> !v.isEmpty()).distinct().toList();
    }

    private static List<String> cleanOrNull(List<String> values) {
        return values == null ? null : clean(values);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
