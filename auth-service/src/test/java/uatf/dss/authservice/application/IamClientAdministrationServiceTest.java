package uatf.dss.authservice.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import uatf.dss.authservice.application.port.in.IamClientCommands;
import uatf.dss.authservice.application.port.in.IamClientViews;
import uatf.dss.authservice.application.port.out.AdminAuditLogRepository;
import uatf.dss.authservice.application.port.out.IdentityClientAdminPort;
import uatf.dss.authservice.application.service.AdminAuditRecorder;
import uatf.dss.authservice.application.service.IamClientAdministrationService;
import uatf.dss.authservice.domain.exception.conflict.IamRuleViolationException;
import uatf.dss.authservice.domain.exception.validation.ValidationException;
import uatf.dss.authservice.domain.model.audit.AdminAuditEntry;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.audit.AuditOutcome;
import uatf.dss.authservice.domain.model.identity.IdentityClient;
import uatf.dss.authservice.domain.model.identity.IdentityClientDraft;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class IamClientAdministrationServiceTest {

    private static final AuditActor ADMIN = new AuditActor("kc-admin", "ana.admin", "203.0.113.9");
    private static final String SECRET = "s3cr3t-value-that-must-not-leak";

    @Mock IdentityClientAdminPort clients;
    @Mock AdminAuditLogRepository auditLog;

    private IamClientAdministrationService service;

    @BeforeEach
    void setUp() {
        service = service(false);
    }

    private IamClientAdministrationService service(boolean requireHttps) {
        return new IamClientAdministrationService(clients,
                new AdminAuditRecorder(auditLog, Clock.fixed(Instant.parse("2026-11-20T10:00:00Z"), ZoneOffset.UTC)),
                requireHttps);
    }

    private static IdentityClient client(String clientId, boolean isPublic, boolean bearerOnly) {
        return new IdentityClient("id-" + clientId, clientId, "App", null, true, isPublic, bearerOnly, true, false,
                List.of("https://app.uatf.edu.bo/*"), List.of("+"), List.of());
    }

    private static IamClientCommands.CreateClient create(String clientId, IamClientCommands.ClientType type,
                                                         boolean serviceAccounts, List<String> redirectUris) {
        return new IamClientCommands.CreateClient(ADMIN, clientId, "App", null, type, true, serviceAccounts,
                redirectUris, List.of("+"), List.of());
    }

    private List<AdminAuditEntry> audits() {
        ArgumentCaptor<AdminAuditEntry> captor = ArgumentCaptor.forClass(AdminAuditEntry.class);
        verify(auditLog, atLeastOnce()).completeIndependently(captor.capture());
        return captor.getAllValues();
    }

    // ---- create --------------------------------------------------------------------------------------------

    @Test
    void confidentialClientGetsItsFirstSecretOnceAndTheAuditNeverHasIt() {
        when(clients.findClient("portal-becas")).thenReturn(Optional.of(client("portal-becas", false, false)));
        when(clients.regenerateClientSecret("portal-becas")).thenReturn(SECRET);

        IamClientViews.CreatedClient created = service.createClient(create("portal-becas",
                IamClientCommands.ClientType.CONFIDENTIAL, true, List.of()));

        ArgumentCaptor<IdentityClientDraft> draft = ArgumentCaptor.forClass(IdentityClientDraft.class);
        verify(clients).createClient(draft.capture());
        assertThat(draft.getValue().publicClient()).isFalse();
        assertThat(draft.getValue().standardFlowEnabled()).as("no redirect URIs, no browser login").isFalse();
        assertThat(draft.getValue().serviceAccountsEnabled()).isTrue();
        assertThat(created.secret()).isEqualTo(SECRET);
        assertThat(created.toString()).doesNotContain(SECRET);
        AdminAuditEntry audit = audits().getFirst();
        assertThat(audit.outcome()).isEqualTo(AuditOutcome.SUCCESS);
        assertThat(audit.after()).containsEntry("issuedOnce", true);
        assertThat(audit.toString()).doesNotContain(SECRET);
    }

    @Test
    void publicClientHasNoSecretAndNeedsARedirectUri() {
        when(clients.findClient("app-movil")).thenReturn(Optional.of(client("app-movil", true, false)));

        IamClientViews.CreatedClient created = service.createClient(create("app-movil",
                IamClientCommands.ClientType.PUBLIC, false, List.of("https://app.uatf.edu.bo/*")));

        assertThat(created.secret()).isNull();
        verify(clients, never()).regenerateClientSecret(anyString());
        assertThat(created.client().type()).isEqualTo(IamClientViews.ClientKind.PUBLIC);

        assertThatThrownBy(() -> service.createClient(create("app-sin-uri", IamClientCommands.ClientType.PUBLIC,
                false, List.of()))).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.createClient(create("app-sa", IamClientCommands.ClientType.PUBLIC,
                true, List.of("https://app.uatf.edu.bo/*")))).isInstanceOf(ValidationException.class);
    }

    @Test
    void rejectsInvalidClientIdsAndUnsafeUrisAsAuditedFailures() {
        assertThatThrownBy(() -> service.createClient(create("Portal Becas", IamClientCommands.ClientType.CONFIDENTIAL,
                false, List.of()))).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.createClient(create("portal-becas", IamClientCommands.ClientType.CONFIDENTIAL,
                false, List.of("https://*.uatf.edu.bo/*")))).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service(true).createClient(create("portal-becas",
                IamClientCommands.ClientType.CONFIDENTIAL, false, List.of("http://becas.uatf.edu.bo/cb"))))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("https");
        verify(clients, never()).createClient(any());
        assertThat(audits()).extracting(AdminAuditEntry::outcome).containsOnly(AuditOutcome.FAILURE);
    }

    // ---- update --------------------------------------------------------------------------------------------

    @Test
    void systemClientsAreReadOnly() {
        when(clients.findClient("olap-service")).thenReturn(Optional.of(client("olap-service", false, false)));

        assertThatThrownBy(() -> service.updateClient(new IamClientCommands.UpdateClient(ADMIN, "olap-service", "X",
                null, null, null, null, null))).isInstanceOf(IamRuleViolationException.class);
        verify(clients, never()).updateClient(anyString(), any());
    }

    @Test
    void bffAllowsEditingUrisButCannotBeDisabled() {
        when(clients.findClient("dss-bff")).thenReturn(Optional.of(client("dss-bff", false, false)));

        service.updateClient(new IamClientCommands.UpdateClient(ADMIN, "dss-bff", null, null, null,
                List.of("https://dss.uatf.edu.bo/api/auth/callback"), null, List.of("https://dss.uatf.edu.bo/login")));
        verify(clients).updateClient("dss-bff", new IdentityClientDraft("dss-bff", null, null, null, null, null, null,
                List.of("https://dss.uatf.edu.bo/api/auth/callback"), null, List.of("https://dss.uatf.edu.bo/login")));

        assertThatThrownBy(() -> service.updateClient(new IamClientCommands.UpdateClient(ADMIN, "dss-bff", null, null,
                false, null, null, null))).isInstanceOf(IamRuleViolationException.class);
    }

    @Test
    void ordinaryClientsCanBeDisabledAndRenamed() {
        when(clients.findClient("portal-becas")).thenReturn(Optional.of(client("portal-becas", false, false)));

        IamClientViews.Client updated = service.updateClient(new IamClientCommands.UpdateClient(ADMIN, "portal-becas",
                " Becas ", null, false, null, List.of("https://becas.uatf.edu.bo"), null));

        verify(clients).updateClient("portal-becas", new IdentityClientDraft("portal-becas", "Becas", null, false,
                null, null, null, null, List.of("https://becas.uatf.edu.bo"), null));
        assertThat(updated.system()).isFalse();
        assertThat(audits().getFirst().action()).isEqualTo("CLIENT_UPDATED");
    }

    // ---- secret rotation -----------------------------------------------------------------------------------

    @Test
    void rotatesAConfidentialClientsSecretAndReturnsItOnce() {
        when(clients.findClient("portal-becas")).thenReturn(Optional.of(client("portal-becas", false, false)));
        when(clients.regenerateClientSecret("portal-becas")).thenReturn(SECRET);

        IamClientViews.IssuedSecret issued = service.rotateSecret(new IamClientCommands.RotateSecret(ADMIN, "portal-becas"));

        assertThat(issued.secret()).isEqualTo(SECRET);
        assertThat(issued.toString()).doesNotContain(SECRET);
        AdminAuditEntry audit = audits().getFirst();
        assertThat(audit.action()).isEqualTo("CLIENT_SECRET_ROTATED");
        assertThat(audit.after()).containsEntry("rotated", true);
        assertThat(audit.toString()).doesNotContain(SECRET);
    }

    @Test
    void systemClientSecretsAreNotRotatedFromTheApiAndPublicClientsHaveNone() {
        when(clients.findClient("dss-bff")).thenReturn(Optional.of(client("dss-bff", false, false)));
        when(clients.findClient("app-movil")).thenReturn(Optional.of(client("app-movil", true, false)));

        assertThatThrownBy(() -> service.rotateSecret(new IamClientCommands.RotateSecret(ADMIN, "dss-bff")))
                .isInstanceOf(IamRuleViolationException.class);
        assertThatThrownBy(() -> service.rotateSecret(new IamClientCommands.RotateSecret(ADMIN, "app-movil")))
                .isInstanceOf(ValidationException.class);
        verify(clients, never()).regenerateClientSecret(anyString());
    }

    @Test
    void listsClientsWithTheirKindAndSystemFlag() {
        when(clients.listClients("dss", 50, 50)).thenReturn(List.of(client("dss-permissions", false, true),
                client("dss-portal-extra", true, false)));

        assertThat(service.listClients("dss", 1, 50)).extracting(IamClientViews.Client::clientId,
                        IamClientViews.Client::type, IamClientViews.Client::system)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("dss-permissions", IamClientViews.ClientKind.BEARER_ONLY, true),
                        org.assertj.core.groups.Tuple.tuple("dss-portal-extra", IamClientViews.ClientKind.PUBLIC, false));
    }
}
