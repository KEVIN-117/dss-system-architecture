package uatf.dss.authservice.application;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import uatf.dss.authservice.application.port.in.IamRoleCommands;
import uatf.dss.authservice.application.port.in.IamRoleViews;
import uatf.dss.authservice.application.port.out.AdminAuditLogRepository;
import uatf.dss.authservice.application.port.out.IdentityRoleAdminPort;
import uatf.dss.authservice.application.service.AdminAuditRecorder;
import uatf.dss.authservice.application.service.IamRoleAdministrationService;
import uatf.dss.authservice.domain.exception.conflict.IamRuleViolationException;
import uatf.dss.authservice.domain.exception.notfound.IdentityResourceNotFoundException;
import uatf.dss.authservice.domain.exception.validation.ValidationException;
import uatf.dss.authservice.domain.model.audit.AdminAuditEntry;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.audit.AuditOutcome;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;
import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.identity.IdentityRoleDraft;
import uatf.dss.authservice.domain.model.identity.IdentityUser;

import java.time.Clock;
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
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class IamRoleAdministrationServiceTest {

    private static final String CATALOG = "dss-permissions";
    private static final AuditActor ADMIN = new AuditActor("kc-admin", "ana.admin", "203.0.113.9");

    @Mock IdentityRoleAdminPort roles;
    @Mock AdminAuditLogRepository auditLog;

    private IamRoleAdministrationService service;

    @BeforeEach
    void setUp() {
        service = new IamRoleAdministrationService(roles,
                new AdminAuditRecorder(auditLog, Clock.fixed(Instant.parse("2026-11-20T10:00:00Z"), ZoneOffset.UTC)),
                CATALOG);
    }

    private static IdentityRole realm(String name, String description, Map<String, List<String>> attributes) {
        return new IdentityRole(UUID.randomUUID().toString(), name, description, false, false, attributes);
    }

    private static IdentityRole permission(String name) {
        return new IdentityRole(UUID.randomUUID().toString(), name, "desc " + name, false, true, Map.of());
    }

    private List<AdminAuditEntry> audits() {
        ArgumentCaptor<AdminAuditEntry> captor = ArgumentCaptor.forClass(AdminAuditEntry.class);
        verify(auditLog, atLeastOnce()).completeIndependently(captor.capture());
        return captor.getAllValues();
    }

    // ---- roles ---------------------------------------------------------------------------------------------

    @Test
    void listsInstitutionalRolesWithPortalAndSystemFlagHidingKeycloakBuiltIns() {
        when(roles.listRealmRoles()).thenReturn(List.of(
                realm("RECTOR", "Rector", Map.of("portal", List.of("rector"))),
                realm("COORDINADOR", null, Map.of()),
                realm("default-roles-uatf-dss-realm", null, Map.of()),
                realm("offline_access", null, Map.of())));

        assertThat(service.listRoles()).containsExactly(
                new IamRoleViews.Role("COORDINADOR", null, null, false),
                new IamRoleViews.Role("RECTOR", "Rector", "rector", true));
    }

    @Test
    void createsARoleWithItsPortalAndAuditsIt() {
        IdentityRole created = realm("COORDINADOR_ACADEMICO", "Coordinación", Map.of("portal", List.of("director")));
        when(roles.findRealmRole("COORDINADOR_ACADEMICO")).thenReturn(Optional.of(created));

        IamRoleViews.Role view = service.createRole(new IamRoleCommands.CreateRole(ADMIN, " COORDINADOR_ACADEMICO ",
                "Coordinación", "director"));

        verify(roles).createRealmRole(new IdentityRoleDraft("COORDINADOR_ACADEMICO", "Coordinación",
                Map.of("portal", List.of("director"))));
        assertThat(view.portal()).isEqualTo("director");
        AdminAuditEntry audit = audits().getFirst();
        assertThat(audit.action()).isEqualTo("ROLE_CREATED");
        assertThat(audit.targetType()).isEqualTo(AuditTargetType.ROLE);
        assertThat(audit.outcome()).isEqualTo(AuditOutcome.SUCCESS);
    }

    @Test
    void rejectsInvalidRoleNamesAndPortalsAsAuditedFailures() {
        assertThatThrownBy(() -> service.createRole(new IamRoleCommands.CreateRole(ADMIN, "coordinador", null, null)))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.createRole(new IamRoleCommands.CreateRole(ADMIN, "COORD", null, "Portal X")))
                .isInstanceOf(ValidationException.class);
        verify(roles, never()).createRealmRole(any());
        assertThat(audits()).extracting(AdminAuditEntry::outcome).containsOnly(AuditOutcome.FAILURE);
    }

    @Test
    void updateKeepsOtherAttributesAndUnchangedFieldsAndCanClearThePortal() {
        IdentityRole current = realm("COORDINADOR", "Antes", Map.of("portal", List.of("director"), "color", List.of("azul")));
        when(roles.findRealmRole("COORDINADOR")).thenReturn(Optional.of(current));

        service.updateRole(new IamRoleCommands.UpdateRole(ADMIN, "COORDINADOR", null, ""));

        verify(roles).updateRealmRole("COORDINADOR", new IdentityRoleDraft("COORDINADOR", "Antes",
                Map.of("color", List.of("azul"))));
    }

    @Test
    void systemRolesCannotBeDeletedEvenWithForce() {
        when(roles.findRealmRole("DECANO")).thenReturn(Optional.of(realm("DECANO", null, Map.of())));

        assertThatThrownBy(() -> service.deleteRole(new IamRoleCommands.DeleteRole(ADMIN, "DECANO", true)))
                .isInstanceOf(IamRuleViolationException.class);
        verify(roles, never()).deleteRealmRole(anyString());
        assertThat(audits().getFirst().outcome()).isEqualTo(AuditOutcome.FAILURE);
    }

    @Test
    void roleWithUsersNeedsForce() {
        when(roles.findRealmRole("COORDINADOR")).thenReturn(Optional.of(realm("COORDINADOR", null, Map.of())));
        when(roles.listUsersWithRealmRole("COORDINADOR", 0, 1))
                .thenReturn(List.of(new IdentityUser("u1", "u1", null, null, null, true, true, null)));

        assertThatThrownBy(() -> service.deleteRole(new IamRoleCommands.DeleteRole(ADMIN, "COORDINADOR", false)))
                .isInstanceOf(IamRuleViolationException.class)
                .hasMessageContaining("force=true");
        verify(roles, never()).deleteRealmRole(anyString());

        service.deleteRole(new IamRoleCommands.DeleteRole(ADMIN, "COORDINADOR", true));
        verify(roles).deleteRealmRole("COORDINADOR");
    }

    @Test
    void unknownRoleIsNotFound() {
        when(roles.findRealmRole("NADA")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getRole("NADA")).isInstanceOf(IdentityResourceNotFoundException.class);
    }

    // ---- role permissions ----------------------------------------------------------------------------------

    @Test
    void replacesOnlyTheDifferenceOfARolesPermissions() {
        when(roles.findRealmRole("DIRECTOR")).thenReturn(Optional.of(realm("DIRECTOR", null, Map.of())));
        when(roles.listRealmRoleClientComposites("DIRECTOR", CATALOG))
                .thenReturn(List.of(permission("analytics:read"), permission("analytics:career")),
                        List.of(permission("analytics:read"), permission("reports:export")));

        List<IamRoleViews.Permission> result = service.replaceRolePermissions(new IamRoleCommands.ReplaceRolePermissions(
                ADMIN, "DIRECTOR", Set.of("analytics:read", "reports:export")));

        verify(roles).addClientCompositesToRealmRole("DIRECTOR", CATALOG, Set.of("reports:export"));
        verify(roles).removeClientCompositesFromRealmRole("DIRECTOR", CATALOG, Set.of("analytics:career"));
        assertThat(result).extracting(IamRoleViews.Permission::name).containsExactly("analytics:read", "reports:export");
        AdminAuditEntry audit = audits().getFirst();
        assertThat(audit.before()).containsEntry("permissions", List.of("analytics:career", "analytics:read"));
        assertThat(audit.after()).containsEntry("permissions", List.of("analytics:read", "reports:export"));
    }

    @Test
    void superadminKeepsEveryIamPermission() {
        when(roles.findRealmRole("SUPERADMIN")).thenReturn(Optional.of(realm("SUPERADMIN", null, Map.of())));
        when(roles.listRealmRoleClientComposites("SUPERADMIN", CATALOG))
                .thenReturn(List.of(permission("iam:roles:write"), permission("connectors:read")));

        assertThatThrownBy(() -> service.replaceRolePermissions(new IamRoleCommands.ReplaceRolePermissions(
                ADMIN, "SUPERADMIN", Set.of("connectors:read")))).isInstanceOf(IamRuleViolationException.class);
        verify(roles, never()).removeClientCompositesFromRealmRole(anyString(), anyString(), anySet());
    }

    // ---- permissions ---------------------------------------------------------------------------------------

    @Test
    void createsAPermissionInTheCatalog() {
        when(roles.findClientRole(CATALOG, "reports:export")).thenReturn(Optional.of(permission("reports:export")));

        IamRoleViews.Permission created = service.createPermission(new IamRoleCommands.CreatePermission(
                ADMIN, "reports:export", " Exportar reportes "));

        verify(roles).createClientRole(CATALOG, new IdentityRoleDraft("reports:export", "Exportar reportes", null));
        assertThat(created).isEqualTo(new IamRoleViews.Permission("reports:export", "desc reports:export",
                "reports", "export", false));
        assertThat(audits().getFirst().action()).isEqualTo("PERMISSION_CREATED");
    }

    @Test
    void rejectsPermissionsThatAreNotResourceAction() {
        for (String invalid : List.of("Reports:export", "reports", "reports:", ":export", "reports export")) {
            assertThatThrownBy(() -> service.createPermission(new IamRoleCommands.CreatePermission(ADMIN, invalid, "x")))
                    .as(invalid).isInstanceOf(ValidationException.class);
        }
        assertThatThrownBy(() -> service.createPermission(new IamRoleCommands.CreatePermission(ADMIN, "reports:export", " ")))
                .isInstanceOf(ValidationException.class);
        verify(roles, never()).createClientRole(anyString(), any());
    }

    @Test
    void systemPermissionsCannotBeDeleted() {
        when(roles.findClientRole(CATALOG, "iam:users:write")).thenReturn(Optional.of(permission("iam:users:write")));
        when(roles.findClientRole(CATALOG, "context:read")).thenReturn(Optional.of(permission("context:read")));

        assertThatThrownBy(() -> service.deletePermission(new IamRoleCommands.DeletePermission(ADMIN, "iam:users:write", true)))
                .isInstanceOf(IamRuleViolationException.class);
        assertThatThrownBy(() -> service.deletePermission(new IamRoleCommands.DeletePermission(ADMIN, "context:read", true)))
                .isInstanceOf(IamRuleViolationException.class);
        verify(roles, never()).deleteClientRole(anyString(), anyString());
    }

    @Test
    void permissionInUseNeedsForceAndReportsWhoUsesIt() {
        when(roles.findClientRole(CATALOG, "reports:export")).thenReturn(Optional.of(permission("reports:export")));
        when(roles.listRealmRoles()).thenReturn(List.of(realm("DIRECTOR", null, Map.of()), realm("RECTOR", null, Map.of())));
        when(roles.listRealmRoleClientComposites("DIRECTOR", CATALOG)).thenReturn(List.of(permission("reports:export")));
        when(roles.listRealmRoleClientComposites("RECTOR", CATALOG)).thenReturn(List.of());
        when(roles.listUsersWithClientRole(eq(CATALOG), eq("reports:export"), anyInt(), anyInt())).thenReturn(List.of());

        assertThatThrownBy(() -> service.deletePermission(new IamRoleCommands.DeletePermission(ADMIN, "reports:export", false)))
                .isInstanceOf(IamRuleViolationException.class)
                .hasMessageContaining("[DIRECTOR]");

        service.deletePermission(new IamRoleCommands.DeletePermission(ADMIN, "reports:export", true));
        verify(roles).deleteClientRole(CATALOG, "reports:export");
        assertThat(audits().getLast().before()).containsEntry("roles", List.of("DIRECTOR"));
    }

    @Test
    void buildsTheRolePermissionMatrix() {
        when(roles.listRealmRoles()).thenReturn(List.of(realm("DIRECTOR", null, Map.of()), realm("RECTOR", null, Map.of()),
                realm("offline_access", null, Map.of())));
        when(roles.listRealmRoleClientComposites("DIRECTOR", CATALOG)).thenReturn(List.of(permission("analytics:read")));
        when(roles.listRealmRoleClientComposites("RECTOR", CATALOG))
                .thenReturn(List.of(permission("analytics:read"), permission("analytics:global")));
        when(roles.listClientRoles(CATALOG)).thenReturn(List.of(permission("analytics:read"), permission("analytics:global")));

        IamRoleViews.Matrix matrix = service.matrix();

        assertThat(matrix.roles()).extracting(IamRoleViews.Role::name).containsExactly("DIRECTOR", "RECTOR");
        assertThat(matrix.permissions()).extracting(IamRoleViews.Permission::name)
                .containsExactly("analytics:global", "analytics:read");
        assertThat(matrix.grants()).containsEntry("DIRECTOR", List.of("analytics:read"))
                .containsEntry("RECTOR", List.of("analytics:global", "analytics:read"));
    }
}
