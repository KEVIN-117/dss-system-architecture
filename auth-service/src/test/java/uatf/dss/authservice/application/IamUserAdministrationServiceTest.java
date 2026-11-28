package uatf.dss.authservice.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import uatf.dss.authservice.application.port.in.IamUserCommands;
import uatf.dss.authservice.application.port.in.IamUserViews;
import uatf.dss.authservice.application.port.in.KeycloakRoleSnapshot;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.application.port.out.AdminAuditLogRepository;
import uatf.dss.authservice.application.port.out.IdentityRoleAdminPort;
import uatf.dss.authservice.application.port.out.IdentityRoleMappingPort;
import uatf.dss.authservice.application.port.out.IdentityUserAdminPort;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.application.service.AcademicScopeResolver;
import uatf.dss.authservice.application.service.AdminAuditRecorder;
import uatf.dss.authservice.application.service.IamUserAdministrationService;
import uatf.dss.authservice.domain.exception.conflict.IamRuleViolationException;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.exception.upstream.IdentityProviderException;
import uatf.dss.authservice.domain.exception.validation.ValidationException;
import uatf.dss.authservice.domain.model.AcademicScope;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.audit.AdminAuditEntry;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.audit.AuditOutcome;
import uatf.dss.authservice.domain.model.identity.IdentityRequiredAction;
import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.identity.IdentityUser;
import uatf.dss.authservice.domain.model.identity.IdentityUserChanges;
import uatf.dss.authservice.domain.model.identity.NewIdentityUser;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class IamUserAdministrationServiceTest {

    private static final String PERMISSIONS = "dss-permissions";
    private static final Duration LIFESPAN = Duration.ofHours(72);

    @Mock IdentityUserAdminPort users;
    @Mock IdentityRoleAdminPort roles;
    @Mock IdentityRoleMappingPort mappings;
    @Mock UserRepository localUsers;
    @Mock SyncUserUseCase syncUser;
    @Mock AdminAuditLogRepository auditLog;

    private IamUserAdministrationService service;

    private final UUID localId = UUID.randomUUID();
    private final UUID keycloakUuid = UUID.randomUUID();
    private final String keycloakId = keycloakUuid.toString();
    private final AuditActor admin = new AuditActor(UUID.randomUUID().toString(), "ana.admin", "203.0.113.9");

    @BeforeEach
    void setUp() {
        service = new IamUserAdministrationService(users, roles, mappings, localUsers, syncUser,
                new AdminAuditRecorder(auditLog, Clock.fixed(Instant.parse("2026-11-20T10:00:00Z"), ZoneOffset.UTC)),
                new AcademicScopeResolver(mappings, PERMISSIONS), PERMISSIONS, LIFESPAN);
        when(localUsers.findById(localId)).thenReturn(Optional.of(localUser(true)));
        when(users.findUserById(keycloakId)).thenReturn(Optional.of(identityUser(true)));
        when(syncUser.sync(any())).thenReturn(localUser(true));
    }

    private User localUser(boolean active) {
        return User.create(localId, keycloakUuid, "selene", "selene@uatf.edu.bo", "Selene", "Rojas", active);
    }

    private IdentityUser identityUser(boolean enabled) {
        return new IdentityUser(keycloakId, "selene", "selene@uatf.edu.bo", "Selene", "Rojas", enabled, false,
                1_790_000_000_000L);
    }

    private static IdentityRole role(String name) {
        return new IdentityRole(UUID.randomUUID().toString(), name, null, false, false, Map.of());
    }

    private static IdentityUser holder(String id, boolean enabled) {
        return new IdentityUser(id, "u-" + id, null, null, null, enabled, true, null);
    }

    private List<AdminAuditEntry> completedAudits() {
        ArgumentCaptor<AdminAuditEntry> captor = ArgumentCaptor.forClass(AdminAuditEntry.class);
        verify(auditLog, org.mockito.Mockito.atLeastOnce()).completeIndependently(captor.capture());
        return captor.getAllValues();
    }

    // ---- create --------------------------------------------------------------------------------------------

    @Test
    void createsTheUserSyncsTheLocalCopyAndSendsTheInvitation() {
        when(users.createUser(any())).thenReturn(keycloakId);
        when(mappings.listUserClientRoles(keycloakId, PERMISSIONS, true))
                .thenReturn(List.of(role("analytics:career"), role("analytics:faculty")));

        IamUserViews.IamUser created = service.createUser(new IamUserCommands.CreateUser(admin, " selene ",
                "selene@uatf.edu.bo", "Selene", "Rojas", true, true));

        verify(users).createUser(new NewIdentityUser("selene", "selene@uatf.edu.bo", "Selene", "Rojas", true, false));
        ArgumentCaptor<SyncUserCommand> sync = ArgumentCaptor.forClass(SyncUserCommand.class);
        verify(syncUser).sync(sync.capture());
        assertThat(sync.getValue().keycloakId()).isEqualTo(keycloakUuid);
        assertThat(sync.getValue().roles()).isEmpty();
        verify(users).sendRequiredActionsEmail(keycloakId,
                Set.of(IdentityRequiredAction.UPDATE_PASSWORD, IdentityRequiredAction.VERIFY_EMAIL), LIFESPAN);
        assertThat(created.id()).isEqualTo(localId);
        assertThat(created.invitationSent()).isTrue();
        assertThat(created.academicScope()).isEqualTo(AcademicScope.FACULTY);
        assertThat(created.createdAt()).isEqualTo(Instant.ofEpochMilli(1_790_000_000_000L));
        assertThat(completedAudits()).extracting(AdminAuditEntry::action, AdminAuditEntry::outcome)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("USER_CREATED", AuditOutcome.SUCCESS),
                        org.assertj.core.groups.Tuple.tuple("USER_ACTIONS_EMAIL_SENT", AuditOutcome.SUCCESS));
    }

    @Test
    void createdUserIsKeptWhenTheInvitationCannotBeSent() {
        when(users.createUser(any())).thenReturn(keycloakId);
        doThrow(new IdentityProviderException("Keycloak respondió con un error (HTTP 500)"))
                .when(users).sendRequiredActionsEmail(any(), anySet(), any());

        IamUserViews.IamUser created = service.createUser(new IamUserCommands.CreateUser(admin, "selene",
                "selene@uatf.edu.bo", null, null, true, true));

        assertThat(created.invitationSent()).isFalse();
        assertThat(completedAudits()).extracting(AdminAuditEntry::outcome)
                .containsExactly(AuditOutcome.SUCCESS, AuditOutcome.FAILURE);
    }

    @Test
    void invitationIsSkippedWhenNotRequested() {
        when(users.createUser(any())).thenReturn(keycloakId);

        IamUserViews.IamUser created = service.createUser(new IamUserCommands.CreateUser(admin, "selene",
                "selene@uatf.edu.bo", null, null, false, false));

        assertThat(created.invitationSent()).isNull();
        verify(users, never()).sendRequiredActionsEmail(any(), anySet(), any());
    }

    // ---- update --------------------------------------------------------------------------------------------

    @Test
    void updatesBasicDataAndRefreshesTheLocalCopy() {
        when(users.findUserById(keycloakId)).thenReturn(Optional.of(identityUser(true)),
                Optional.of(new IdentityUser(keycloakId, "selene", "nuevo@uatf.edu.bo", "Selene", "Rojas", true, false, null)));

        IamUserViews.IamUser updated = service.updateUser(new IamUserCommands.UpdateUser(admin, localId,
                " nuevo@uatf.edu.bo ", null, null, null));

        verify(users).updateUser(keycloakId, new IdentityUserChanges("nuevo@uatf.edu.bo", null, null, null, null));
        ArgumentCaptor<SyncUserCommand> sync = ArgumentCaptor.forClass(SyncUserCommand.class);
        verify(syncUser).sync(sync.capture());
        assertThat(sync.getValue().email()).isEqualTo("nuevo@uatf.edu.bo");
        assertThat(sync.getValue().roles()).as("roles are left untouched").isNull();
        assertThat(updated.email()).isEqualTo("nuevo@uatf.edu.bo");
        AdminAuditEntry audit = completedAudits().getFirst();
        assertThat(audit.action()).isEqualTo("USER_UPDATED");
        assertThat(audit.before()).containsEntry("email", "selene@uatf.edu.bo");
        assertThat(audit.after()).containsEntry("email", "nuevo@uatf.edu.bo");
    }

    @Test
    void adminCannotDisableTheirOwnAccountAndTheAttemptIsAudited() {
        AuditActor self = new AuditActor(keycloakId, "selene", "10.0.0.1");

        assertThatThrownBy(() -> service.updateUser(new IamUserCommands.UpdateUser(self, localId, null, null, null, false)))
                .isInstanceOf(IamRuleViolationException.class)
                .hasMessageContaining("propia cuenta");

        verify(users, never()).updateUser(any(), any());
        assertThat(completedAudits().getFirst().outcome()).isEqualTo(AuditOutcome.FAILURE);
    }

    @Test
    void lastEnabledSuperadminCannotBeDisabled() {
        when(roles.listUsersWithRealmRole(eq("SUPERADMIN"), eq(0), any(Integer.class)))
                .thenReturn(List.of(holder(keycloakId, true), holder("other", false)));

        assertThatThrownBy(() -> service.updateUser(new IamUserCommands.UpdateUser(admin, localId, null, null, null, false)))
                .isInstanceOf(IamRuleViolationException.class)
                .hasMessageContaining("último SUPERADMIN");
        verify(users, never()).updateUser(any(), any());
    }

    @Test
    void superadminCanBeDisabledWhenAnotherEnabledOneExists() {
        when(roles.listUsersWithRealmRole(eq("SUPERADMIN"), eq(0), any(Integer.class)))
                .thenReturn(List.of(holder(keycloakId, true), holder("other", true)));

        service.updateUser(new IamUserCommands.UpdateUser(admin, localId, null, null, null, false));

        verify(users).updateUser(keycloakId, new IdentityUserChanges(null, null, null, false, null));
    }

    @Test
    void unknownLocalUserIsNotFound() {
        UUID missing = UUID.randomUUID();
        assertThatThrownBy(() -> service.getRoles(missing)).isInstanceOf(UserNotFoundException.class);
    }

    // ---- roles ---------------------------------------------------------------------------------------------

    @Test
    void replacesOnlyTheDifferenceAndKeepsKeycloakBuiltInRoles() {
        when(mappings.listUserRealmRoles(keycloakId, false))
                .thenReturn(List.of(role("DIRECTOR"), role("default-roles-uatf-dss-realm")),
                        List.of(role("DECANO"), role("default-roles-uatf-dss-realm")));
        when(mappings.listUserRealmRoles(keycloakId, true)).thenReturn(List.of(role("DECANO"), role("offline_access")));

        IamUserViews.IamAssignments result = service.replaceRoles(
                new IamUserCommands.ReplaceRoles(admin, localId, Set.of("DECANO", " ")));

        verify(mappings).addUserRealmRoles(keycloakId, Set.of("DECANO"));
        verify(mappings).removeUserRealmRoles(keycloakId, Set.of("DIRECTOR"));
        assertThat(result.direct()).extracting(IamUserViews.IamRole::name).containsExactly("DECANO");
        assertThat(result.effective()).extracting(IamUserViews.IamRole::name).containsExactly("DECANO");
        ArgumentCaptor<SyncUserCommand> sync = ArgumentCaptor.forClass(SyncUserCommand.class);
        verify(syncUser).sync(sync.capture());
        assertThat(sync.getValue().roles()).extracting(KeycloakRoleSnapshot::name)
                .contains("DECANO");
        AdminAuditEntry audit = completedAudits().getFirst();
        assertThat(audit.before()).containsEntry("realmRoles", List.of("DIRECTOR"));
        assertThat(audit.after()).containsEntry("realmRoles", List.of("DECANO"));
    }

    @Test
    void builtInRolesCannotBeAssigned() {
        assertThatThrownBy(() -> service.replaceRoles(new IamUserCommands.ReplaceRoles(admin, localId,
                Set.of("offline_access")))).isInstanceOf(ValidationException.class);
        verify(mappings, never()).addUserRealmRoles(any(), anySet());
    }

    @Test
    void lastSuperadminKeepsTheRole() {
        when(mappings.listUserRealmRoles(keycloakId, false)).thenReturn(List.of(role("SUPERADMIN")));
        when(roles.listUsersWithRealmRole(eq("SUPERADMIN"), eq(0), any(Integer.class)))
                .thenReturn(List.of(holder(keycloakId, true)));

        assertThatThrownBy(() -> service.replaceRoles(new IamUserCommands.ReplaceRoles(admin, localId, Set.of())))
                .isInstanceOf(IamRuleViolationException.class);

        verify(mappings, never()).removeUserRealmRoles(any(), anySet());
        assertThat(completedAudits().getFirst().outcome()).isEqualTo(AuditOutcome.FAILURE);
    }

    // ---- permissions ---------------------------------------------------------------------------------------

    @Test
    void replacesDirectPermissionsOnTheCatalogClient() {
        when(mappings.listUserClientRoles(keycloakId, PERMISSIONS, false))
                .thenReturn(List.of(role("dw:closure:read")), List.of(role("olap:admin")));
        when(mappings.listUserClientRoles(keycloakId, PERMISSIONS, true))
                .thenReturn(List.of(role("olap:admin"), role("analytics:read")));

        IamUserViews.IamAssignments result = service.replacePermissions(
                new IamUserCommands.ReplacePermissions(admin, localId, Set.of("olap:admin")));

        verify(mappings).addUserClientRoles(keycloakId, PERMISSIONS, Set.of("olap:admin"));
        verify(mappings).removeUserClientRoles(keycloakId, PERMISSIONS, Set.of("dw:closure:read"));
        assertThat(result.direct()).extracting(IamUserViews.IamRole::name).containsExactly("olap:admin");
        assertThat(result.effective()).extracting(IamUserViews.IamRole::name)
                .containsExactly("analytics:read", "olap:admin");
        verify(syncUser, never()).sync(any());
        assertThat(completedAudits().getFirst().action()).isEqualTo("USER_PERMISSIONS_REPLACED");
    }

    // ---- actions e-mail ------------------------------------------------------------------------------------

    @Test
    void sendsRequestedActionsWithDefaultLifespan() {
        service.sendActionsEmail(new IamUserCommands.SendActionsEmail(admin, localId,
                Set.of(IdentityRequiredAction.UPDATE_PASSWORD), null));

        verify(users, times(1)).sendRequiredActionsEmail(keycloakId, Set.of(IdentityRequiredAction.UPDATE_PASSWORD), LIFESPAN);
        assertThat(completedAudits().getFirst().after()).containsEntry("actions", List.of("UPDATE_PASSWORD"));
    }

    @Test
    void emptyActionsAreRejected() {
        assertThatThrownBy(() -> service.sendActionsEmail(new IamUserCommands.SendActionsEmail(admin, localId,
                Set.of(), null))).isInstanceOf(ValidationException.class);
    }
}
