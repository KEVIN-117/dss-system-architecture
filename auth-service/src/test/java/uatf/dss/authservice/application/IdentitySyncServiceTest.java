package uatf.dss.authservice.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import uatf.dss.authservice.application.port.in.IdentitySyncUseCase.ResyncReport;
import uatf.dss.authservice.application.port.in.IdentitySyncUseCase.RoleChangeNotice;
import uatf.dss.authservice.application.port.in.KeycloakRoleSnapshot;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.application.port.out.AdminAuditLogRepository;
import uatf.dss.authservice.application.port.out.IdentityRoleAdminPort;
import uatf.dss.authservice.application.port.out.IdentityRoleMappingPort;
import uatf.dss.authservice.application.port.out.IdentityUserAdminPort;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.application.service.AdminAuditRecorder;
import uatf.dss.authservice.application.service.IdentitySyncService;
import uatf.dss.authservice.domain.exception.upstream.IdentityProviderException;
import uatf.dss.authservice.domain.model.audit.AdminAuditEntry;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.audit.AuditOutcome;
import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.identity.IdentityUser;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class IdentitySyncServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-20T10:00:00Z");
    private static final AuditActor ADMIN = new AuditActor("kc-admin", "ana.admin", "203.0.113.9");

    private final IdentityUserAdminPort users = mock(IdentityUserAdminPort.class);
    private final IdentityRoleAdminPort roles = mock(IdentityRoleAdminPort.class);
    private final IdentityRoleMappingPort mappings = mock(IdentityRoleMappingPort.class);
    private final UserRepository localUsers = mock(UserRepository.class);
    private final SyncUserUseCase syncUser = mock(SyncUserUseCase.class);
    private final AdminAuditLogRepository auditLog = mock(AdminAuditLogRepository.class);
    private IdentitySyncService service;

    @BeforeEach
    void setUp() {
        service = new IdentitySyncService(users, roles, mappings, localUsers, syncUser,
                new AdminAuditRecorder(auditLog, Clock.fixed(NOW, ZoneOffset.UTC)), Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static IdentityUser user(UUID id, String username) {
        return new IdentityUser(id.toString(), username, username + "@uatf.edu.bo", "N", "A", true, true, null);
    }

    private static IdentityRole realmRole(String name) {
        return new IdentityRole("id-" + name, name, null, false, false, Map.of());
    }

    @Test
    void removingALocalUserIsALogicalDeletionStampedNow() {
        UUID id = UUID.randomUUID();
        when(localUsers.markDeleted(id, NOW)).thenReturn(true);

        assertThat(service.removeLocalUser(id)).isTrue();
        verify(localUsers).markDeleted(id, NOW);
    }

    @Test
    void compositesChangeResyncsEveryLocalHolderWithEffectiveRoles() {
        UUID ana = UUID.randomUUID();
        UUID luis = UUID.randomUUID();
        when(localUsers.findKeycloakIdsByRoleNames(Set.of("DECANO"))).thenReturn(List.of(ana, luis));
        when(users.findUserById(ana.toString())).thenReturn(Optional.of(user(ana, "ana")));
        when(users.findUserById(luis.toString())).thenReturn(Optional.empty());
        when(mappings.listUserRealmRoles(ana.toString(), true)).thenReturn(List.of(realmRole("DECANO"),
                realmRole("DIRECTOR")));

        int resynced = service.resyncAfterRoleChange(
                new RoleChangeNotice("DECANO", false, null, RoleChangeNotice.Change.COMPOSITES_ADDED, true));

        assertThat(resynced).isEqualTo(2);
        verify(syncUser).sync(new SyncUserCommand(ana, "ana", "ana@uatf.edu.bo", "N", "A", true,
                List.of(new KeycloakRoleSnapshot("DECANO", false), new KeycloakRoleSnapshot("DIRECTOR", false))));
        verify(localUsers).markDeleted(luis, NOW); // gone from Keycloak meanwhile
        verify(roles, never()).listRealmRoles();
    }

    @Test
    void permissionOnlyChangesNeedNoResync() {
        assertThat(service.resyncAfterRoleChange(
                new RoleChangeNotice("DECANO", false, null, RoleChangeNotice.Change.COMPOSITES_ADDED, false))).isZero();
        verifyNoInteractions(localUsers, users, mappings, syncUser);
    }

    @Test
    void deletedOrRenamedRolesResyncHoldersOfNamesKeycloakNoLongerHas() {
        UUID ana = UUID.randomUUID();
        when(roles.listRealmRoles()).thenReturn(List.of(realmRole("DECANO"), realmRole("NUEVO")));
        when(localUsers.findAssignedRoleNames()).thenReturn(Set.of("DECANO", "VIEJO"));
        when(localUsers.findKeycloakIdsByRoleNames(Set.of("VIEJO"))).thenReturn(List.of(ana));
        when(users.findUserById(ana.toString())).thenReturn(Optional.of(user(ana, "ana")));
        when(mappings.listUserRealmRoles(ana.toString(), true)).thenReturn(List.of(realmRole("NUEVO")));

        // A role deleted by id arrives without a name.
        assertThat(service.resyncAfterRoleChange(
                new RoleChangeNotice(null, false, null, RoleChangeNotice.Change.DELETED, true))).isEqualTo(1);

        ArgumentCaptor<SyncUserCommand> command = ArgumentCaptor.forClass(SyncUserCommand.class);
        verify(syncUser).sync(command.capture());
        assertThat(command.getValue().roles()).containsExactly(new KeycloakRoleSnapshot("NUEVO", false));
    }

    @Test
    void clientRoleWithRealmCompositesResyncsItsDirectHolders() {
        UUID ana = UUID.randomUUID();
        when(roles.listUsersWithClientRole("dss-permissions", "legacy", 0, 100)).thenReturn(List.of(user(ana, "ana")));
        when(users.findUserById(ana.toString())).thenReturn(Optional.of(user(ana, "ana")));
        when(mappings.listUserRealmRoles(ana.toString(), true)).thenReturn(List.of());

        assertThat(service.resyncAfterRoleChange(new RoleChangeNotice("legacy", true, "dss-permissions",
                RoleChangeNotice.Change.COMPOSITES_ADDED, true))).isEqualTo(1);
        verify(localUsers, never()).findKeycloakIdsByRoleNames(anyCollection());
    }

    @Test
    void fullResyncPagesThroughKeycloakAndRemovesUsersItNoLongerHas() {
        List<IdentityUser> keycloak = IntStream.range(0, 150)
                .mapToObj(i -> user(UUID.randomUUID(), "user" + i)).toList();
        when(users.searchUsers(null, 0, 100)).thenReturn(keycloak.subList(0, 100));
        when(users.searchUsers(null, 100, 100)).thenReturn(keycloak.subList(100, 150));
        when(users.countUsers(null)).thenReturn(150L);
        when(mappings.listUserRealmRoles(anyString(), eq(true))).thenReturn(List.of(realmRole("DIRECTOR")));
        UUID orphan = UUID.randomUUID();
        UUID kept = UUID.fromString(keycloak.getFirst().id());
        when(localUsers.findLiveKeycloakIds()).thenReturn(Set.of(orphan, kept));
        when(localUsers.markDeleted(orphan, NOW)).thenReturn(true);

        ResyncReport report = service.resyncAll(ADMIN);

        assertThat(report).isEqualTo(new ResyncReport(150, 150, 0, 1));
        verify(syncUser, times(150)).sync(any());
        verify(localUsers).markDeleted(orphan, NOW);
        verify(localUsers, never()).markDeleted(eq(kept), any());
        ArgumentCaptor<AdminAuditEntry> audit = ArgumentCaptor.forClass(AdminAuditEntry.class);
        verify(auditLog).completeIndependently(audit.capture());
        assertThat(audit.getValue().action()).isEqualTo("USERS_RESYNCED");
        assertThat(audit.getValue().outcome()).isEqualTo(AuditOutcome.SUCCESS);
        assertThat(audit.getValue().after()).containsEntry("removed", 1).containsEntry("scanned", 150);
    }

    @Test
    void fullResyncNeverDeletesFromAPartialViewOfKeycloak() {
        UUID ana = UUID.randomUUID();
        when(users.searchUsers(null, 0, 100)).thenReturn(List.of(user(ana, "ana")));
        when(users.countUsers(null)).thenReturn(2L); // a user was created while paging
        when(mappings.listUserRealmRoles(anyString(), eq(true))).thenReturn(List.of());

        assertThatThrownBy(() -> service.resyncAll(ADMIN)).isInstanceOf(IdentityProviderException.class);
        verify(localUsers, never()).markDeleted(any(), any());
        ArgumentCaptor<AdminAuditEntry> audit = ArgumentCaptor.forClass(AdminAuditEntry.class);
        verify(auditLog).completeIndependently(audit.capture());
        assertThat(audit.getValue().outcome()).isEqualTo(AuditOutcome.FAILURE);
    }

    @Test
    void usersThatBreakLocalRulesAreSkippedNotRemovedAndDoNotAbortTheResync() {
        UUID ana = UUID.randomUUID();
        UUID sinCorreo = UUID.randomUUID();
        when(users.searchUsers(null, 0, 100)).thenReturn(List.of(user(ana, "ana"),
                new IdentityUser(sinCorreo.toString(), "sin.correo", null, null, null, true, false, null)));
        when(users.countUsers(null)).thenReturn(2L);
        when(mappings.listUserRealmRoles(anyString(), eq(true))).thenReturn(List.of());
        when(localUsers.findLiveKeycloakIds()).thenReturn(Set.of(sinCorreo));

        assertThat(service.resyncAll(ADMIN)).isEqualTo(new ResyncReport(2, 1, 1, 0));
        verify(syncUser, times(1)).sync(any());
        verify(localUsers, never()).markDeleted(any(), any());
        verify(mappings, never()).listUserRealmRoles(sinCorreo.toString(), true);
    }

    @Test
    void pagingStopsOnAShortPage() {
        when(users.searchUsers(null, 0, 100)).thenReturn(List.of());
        when(users.countUsers(null)).thenReturn(0L);
        when(localUsers.findLiveKeycloakIds()).thenReturn(Set.of());

        assertThat(service.resyncAll(ADMIN)).isEqualTo(new ResyncReport(0, 0, 0, 0));
        verify(users, times(1)).searchUsers(any(), anyInt(), anyInt());
    }
}
