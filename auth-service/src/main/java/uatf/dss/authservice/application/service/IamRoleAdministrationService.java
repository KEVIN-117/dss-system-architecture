package uatf.dss.authservice.application.service;

import uatf.dss.authservice.application.port.in.IamRoleAdministrationUseCase;
import uatf.dss.authservice.application.port.in.IamRoleCommands;
import uatf.dss.authservice.application.port.in.IamRoleViews;
import uatf.dss.authservice.application.port.out.IdentityRoleAdminPort;
import uatf.dss.authservice.domain.exception.conflict.IamRuleViolationException;
import uatf.dss.authservice.domain.exception.notfound.IdentityResourceNotFoundException;
import uatf.dss.authservice.domain.exception.validation.ValidationException;
import uatf.dss.authservice.domain.model.KeycloakBuiltInRoles;
import uatf.dss.authservice.domain.model.PortalApplication;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;
import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.identity.IdentityRoleDraft;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Implements {@link IamRoleAdministrationUseCase} on {@link IdentityRoleAdminPort}. Rules:
 * <ul>
 *     <li>System roles (SUPERADMIN, RECTOR, DECANO, DIRECTOR and Keycloak's built-ins) and system permissions
 *     ({@code iam:*}, {@code context:read}) can be edited but never deleted.</li>
 *     <li>SUPERADMIN always keeps every {@code iam:*} permission, so administration cannot lock itself out.</li>
 *     <li>A role held by users, or a permission grouped by a role or held by a user, is only deleted with
 *     {@code force}.</li>
 *     <li>Names are validated ({@code ROLE_NAME}, {@code resource:action}) and immutable; every write is audited.</li>
 *     <li>Every role belongs to exactly one application (IAM-021): it groups exactly one {@code portal:*} permission,
 *     required on create and changed only through the role, never through its permissions. System roles keep the
 *     application of their portal. {@code portal:*} permissions are not created or deleted by hand.</li>
 * </ul>
 */
public class IamRoleAdministrationService implements IamRoleAdministrationUseCase {

    public static final Set<String> SYSTEM_ROLES = Set.of("SUPERADMIN", "RECTOR", "DECANO", "DIRECTOR");
    static final Pattern ROLE_NAME = Pattern.compile("^[A-Z][A-Z0-9_]{1,49}$");
    static final Pattern PERMISSION_NAME = Pattern.compile("^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)+$");
    static final int MAX_PERMISSION_NAME = 100;
    /** Free-text attribute used before IAM-021; translated to portal:* by iam-020 and dropped on update. */
    private static final String LEGACY_PORTAL_ATTRIBUTE = "portal";
    private static final String IAM_PREFIX = "iam:";
    private static final String CONTEXT_READ = "context:read";

    private final IdentityRoleAdminPort roles;
    private final AdminAuditRecorder audit;
    private final String permissionsClientId;

    public IamRoleAdministrationService(IdentityRoleAdminPort roles, AdminAuditRecorder audit,
                                       String permissionsClientId) {
        this.roles = roles;
        this.audit = audit;
        this.permissionsClientId = permissionsClientId;
    }

    // ---- roles ---------------------------------------------------------------------------------------------

    @Override
    public List<IamRoleViews.Role> listRoles() {
        return roles.listRealmRoles().stream()
                .filter(role -> !KeycloakBuiltInRoles.isBuiltIn(role.name()))
                .map(role -> roleView(role, compositeNames(role.name())))
                .sorted(Comparator.comparing(IamRoleViews.Role::name))
                .toList();
    }

    @Override
    public IamRoleViews.Role getRole(String name) {
        IdentityRole role = realmRole(name);
        return roleView(role, compositeNames(role.name()));
    }

    @Override
    public IamRoleViews.Role createRole(IamRoleCommands.CreateRole command) {
        String name = trim(command.name());
        String portal = blankToNull(command.portal());
        IdentityRoleDraft draft = new IdentityRoleDraft(name, blankToNull(command.description()), Map.of());
        audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "ROLE_CREATED", AuditTargetType.ROLE, name, null),
                () -> {
                    if (name == null || !ROLE_NAME.matcher(name).matches()) {
                        throw new ValidationException("Nombre de rol inválido: usa MAYÚSCULAS, números y guion bajo "
                                + "(2 a 50 caracteres), por ejemplo COORDINADOR_ACADEMICO.");
                    }
                    if (KeycloakBuiltInRoles.isBuiltIn(name)) {
                        throw new ValidationException("El nombre " + name + " está reservado por Keycloak.");
                    }
                    PortalApplication application = requireApplication(portal);
                    roles.createRealmRole(draft);
                    try {
                        roles.addClientCompositesToRealmRole(name, permissionsClientId, Set.of(application.permission()));
                    } catch (RuntimeException failure) {
                        // A role without its application would open nothing: undo the creation.
                        try {
                            roles.deleteRealmRole(name);
                        } catch (RuntimeException rollbackFailure) {
                            failure.addSuppressed(rollbackFailure);
                        }
                        throw failure;
                    }
                    return realmRole(name);
                },
                this::roleSnapshot);
        return getRole(name);
    }

    @Override
    public IamRoleViews.Role updateRole(IamRoleCommands.UpdateRole command) {
        String name = trim(command.name());
        IdentityRole current = realmRole(name);
        Set<String> currentPermissions = compositeNames(name);
        IdentityRole updated = audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "ROLE_UPDATED", AuditTargetType.ROLE, name,
                        () -> roleSnapshot(current, currentPermissions)),
                () -> {
                    PortalApplication application = command.portal() == null
                            ? null : requireApplication(blankToNull(command.portal()));
                    if (application != null) {
                        PortalApplication fixed = PortalApplication.ofSystemRole(name).orElse(null);
                        if (fixed != null && fixed != application) {
                            throw new IamRuleViolationException("El rol " + name + " es del sistema y siempre abre la "
                                    + "aplicación " + fixed.id() + ".");
                        }
                    }
                    String description = command.description() == null
                            ? current.description() : blankToNull(command.description());
                    // The legacy free-text attribute "portal" is dropped: the application is the portal:* composite.
                    roles.updateRealmRole(name, new IdentityRoleDraft(name, description,
                            withoutLegacyPortalAttribute(current.attributes())));
                    if (application != null) {
                        setApplication(name, currentPermissions, application);
                    }
                    return realmRole(name);
                },
                this::roleSnapshot);
        return roleView(updated, compositeNames(name));
    }

    @Override
    public void deleteRole(IamRoleCommands.DeleteRole command) {
        String name = trim(command.name());
        IdentityRole current = realmRole(name);
        audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "ROLE_DELETED", AuditTargetType.ROLE, name,
                        () -> {
                            Set<String> permissions = compositeNames(name);
                            Map<String, Object> before = roleSnapshot(current, permissions);
                            before.put("permissions", List.copyOf(permissions));
                            return before;
                        }),
                () -> {
                    if (isSystemRole(name)) {
                        throw new IamRuleViolationException("El rol " + name + " es del sistema y no se puede eliminar.");
                    }
                    if (!command.force() && !roles.listUsersWithRealmRole(name, 0, 1).isEmpty()) {
                        throw new IamRuleViolationException("El rol " + name
                                + " está asignado a usuarios. Quítaselo antes o confirma con force=true.");
                    }
                    roles.deleteRealmRole(name);
                    return name;
                },
                deleted -> Map.of("deleted", true, "forced", command.force()));
    }

    // ---- role ↔ permissions --------------------------------------------------------------------------------

    @Override
    public List<IamRoleViews.Permission> getRolePermissions(String roleName) {
        realmRole(roleName);
        return permissionViews(roles.listRealmRoleClientComposites(trim(roleName), permissionsClientId));
    }

    @Override
    public List<IamRoleViews.Permission> replaceRolePermissions(IamRoleCommands.ReplaceRolePermissions command) {
        String roleName = trim(command.roleName());
        realmRole(roleName);
        Set<String> requested = command.permissions().stream().filter(Objects::nonNull).map(String::trim)
                .filter(name -> !name.isEmpty()).collect(Collectors.toCollection(TreeSet::new));
        Set<String> current = permissionNames(roles.listRealmRoleClientComposites(roleName, permissionsClientId));
        // The application is not part of the grid: the portal:* the role has are kept even if the list omits them.
        current.stream().filter(PortalApplication::isPortalPermission).forEach(requested::add);

        audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "ROLE_PERMISSIONS_REPLACED", AuditTargetType.ROLE,
                        roleName, () -> Map.of("permissions", List.copyOf(current))),
                () -> {
                    Set<String> toAdd = difference(requested, current);
                    Set<String> toRemove = difference(current, requested);
                    List<String> portals = toAdd.stream().filter(PortalApplication::isPortalPermission).toList();
                    if (!portals.isEmpty()) {
                        throw new ValidationException("La aplicación del rol (" + String.join(", ", portals)
                                + ") se cambia al editar el rol, no en sus permisos.");
                    }
                    if ("SUPERADMIN".equals(roleName)
                            && toRemove.stream().anyMatch(permission -> permission.startsWith(IAM_PREFIX))) {
                        throw new IamRuleViolationException(
                                "SUPERADMIN debe conservar todos los permisos iam:* para no perder la administración.");
                    }
                    roles.addClientCompositesToRealmRole(roleName, permissionsClientId, toAdd);
                    roles.removeClientCompositesFromRealmRole(roleName, permissionsClientId, toRemove);
                    return permissionNames(roles.listRealmRoleClientComposites(roleName, permissionsClientId));
                },
                result -> Map.of("permissions", List.copyOf(result)));
        return getRolePermissions(roleName);
    }

    // ---- permissions ---------------------------------------------------------------------------------------

    @Override
    public List<IamRoleViews.Permission> listPermissions() {
        return permissionViews(roles.listClientRoles(permissionsClientId));
    }

    @Override
    public IamRoleViews.Permission createPermission(IamRoleCommands.CreatePermission command) {
        String name = trim(command.name());
        IdentityRole created = audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "PERMISSION_CREATED", AuditTargetType.PERMISSION,
                        name, null),
                () -> {
                    if (name == null || name.length() > MAX_PERMISSION_NAME || !PERMISSION_NAME.matcher(name).matches()) {
                        throw new ValidationException("Nombre de permiso inválido: usa el formato recurso:acción en "
                                + "minúsculas (hasta " + MAX_PERMISSION_NAME + " caracteres), por ejemplo reports:export.");
                    }
                    if (PortalApplication.isPortalPermission(name)) {
                        throw new ValidationException("Los permisos portal:* representan las aplicaciones ("
                                + PortalApplication.ids() + ") y no se crean a mano.");
                    }
                    if (command.description() == null || command.description().isBlank()) {
                        throw new ValidationException("Describe qué permite el permiso.");
                    }
                    roles.createClientRole(permissionsClientId, new IdentityRoleDraft(name, command.description().trim(), null));
                    return clientRole(name);
                },
                IamRoleAdministrationService::permissionSnapshot);
        return permissionView(created);
    }

    @Override
    public IamRoleViews.Permission updatePermission(IamRoleCommands.UpdatePermission command) {
        String name = trim(command.name());
        IdentityRole current = clientRole(name);
        IdentityRole updated = audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "PERMISSION_UPDATED", AuditTargetType.PERMISSION,
                        name, () -> permissionSnapshot(current)),
                () -> {
                    if (command.description() == null || command.description().isBlank()) {
                        throw new ValidationException("Describe qué permite el permiso.");
                    }
                    roles.updateClientRole(permissionsClientId, name,
                            new IdentityRoleDraft(name, command.description().trim(), null));
                    return clientRole(name);
                },
                IamRoleAdministrationService::permissionSnapshot);
        return permissionView(updated);
    }

    @Override
    public void deletePermission(IamRoleCommands.DeletePermission command) {
        String name = trim(command.name());
        IdentityRole current = clientRole(name);
        audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "PERMISSION_DELETED", AuditTargetType.PERMISSION,
                        name, () -> {
                    Map<String, Object> before = permissionSnapshot(current);
                    before.put("roles", rolesGranting(name));
                    return before;
                }),
                () -> {
                    if (isSystemPermission(name)) {
                        throw new IamRuleViolationException("El permiso " + name + " es del sistema y no se puede eliminar.");
                    }
                    if (!command.force()) {
                        List<String> grantingRoles = rolesGranting(name);
                        boolean heldByUsers = !roles.listUsersWithClientRole(permissionsClientId, name, 0, 1).isEmpty();
                        if (!grantingRoles.isEmpty() || heldByUsers) {
                            throw new IamRuleViolationException("El permiso " + name + " está en uso"
                                    + (grantingRoles.isEmpty() ? "" : " por los roles " + grantingRoles)
                                    + (heldByUsers ? " y por usuarios" : "")
                                    + ". Quítalo antes o confirma con force=true.");
                        }
                    }
                    roles.deleteClientRole(permissionsClientId, name);
                    return name;
                },
                deleted -> Map.of("deleted", true, "forced", command.force()));
    }

    // ---- matrix --------------------------------------------------------------------------------------------

    @Override
    public IamRoleViews.Matrix matrix() {
        List<IamRoleViews.Role> roleViews = new ArrayList<>();
        Map<String, List<String>> grants = new LinkedHashMap<>();
        roles.listRealmRoles().stream()
                .filter(role -> !KeycloakBuiltInRoles.isBuiltIn(role.name()))
                .sorted(Comparator.comparing(IdentityRole::name))
                .forEach(role -> {
                    Set<String> permissions = compositeNames(role.name());
                    roleViews.add(roleView(role, permissions));
                    grants.put(role.name(), List.copyOf(permissions));
                });
        return new IamRoleViews.Matrix(roleViews, listPermissions(), grants);
    }

    // ---- helpers -------------------------------------------------------------------------------------------

    public static boolean isSystemRole(String name) {
        return SYSTEM_ROLES.contains(name) || KeycloakBuiltInRoles.isBuiltIn(name);
    }

    public static boolean isSystemPermission(String name) {
        return name.startsWith(IAM_PREFIX) || CONTEXT_READ.equals(name) || PortalApplication.isPortalPermission(name);
    }

    private List<String> rolesGranting(String permission) {
        List<String> granting = new ArrayList<>();
        for (IdentityRole role : roles.listRealmRoles()) {
            if (!KeycloakBuiltInRoles.isBuiltIn(role.name())
                    && permissionNames(roles.listRealmRoleClientComposites(role.name(), permissionsClientId))
                    .contains(permission)) {
                granting.add(role.name());
            }
        }
        granting.sort(Comparator.naturalOrder());
        return granting;
    }

    private IdentityRole realmRole(String name) {
        String trimmed = trim(name);
        return roles.findRealmRole(trimmed).orElseThrow(() ->
                new IdentityResourceNotFoundException("No existe el rol " + trimmed + "."));
    }

    private IdentityRole clientRole(String name) {
        String trimmed = trim(name);
        return roles.findClientRole(permissionsClientId, trimmed).orElseThrow(() ->
                new IdentityResourceNotFoundException("No existe el permiso " + trimmed + "."));
    }

    private static PortalApplication requireApplication(String id) {
        if (id == null) {
            throw new ValidationException("Elige la aplicación del rol: " + PortalApplication.ids() + ".");
        }
        return PortalApplication.fromId(id).orElseThrow(() -> new ValidationException(
                "Aplicación inválida: usa " + PortalApplication.ids() + "."));
    }

    /** Leaves the role grouping exactly the access permission of {@code application}. */
    private void setApplication(String roleName, Set<String> currentPermissions, PortalApplication application) {
        Set<String> stale = currentPermissions.stream()
                .filter(PortalApplication::isPortalPermission)
                .filter(permission -> !permission.equals(application.permission()))
                .collect(Collectors.toCollection(TreeSet::new));
        if (!currentPermissions.contains(application.permission())) {
            roles.addClientCompositesToRealmRole(roleName, permissionsClientId, Set.of(application.permission()));
        }
        if (!stale.isEmpty()) {
            roles.removeClientCompositesFromRealmRole(roleName, permissionsClientId, stale);
        }
    }

    private Set<String> compositeNames(String roleName) {
        return permissionNames(roles.listRealmRoleClientComposites(roleName, permissionsClientId));
    }

    /** The application of a role: its first known {@code portal:*} permission, if any. */
    private static Optional<PortalApplication> applicationOf(Set<String> permissions) {
        return permissions.stream().map(PortalApplication::fromPermission).flatMap(Optional::stream).findFirst();
    }

    private static Map<String, List<String>> withoutLegacyPortalAttribute(Map<String, List<String>> current) {
        Map<String, List<String>> attributes = new HashMap<>(current == null ? Map.of() : current);
        attributes.remove(LEGACY_PORTAL_ATTRIBUTE);
        return attributes;
    }

    private static IamRoleViews.Role roleView(IdentityRole role, Set<String> permissions) {
        return new IamRoleViews.Role(role.name(), role.description(),
                applicationOf(permissions).map(PortalApplication::id).orElse(null), isSystemRole(role.name()));
    }

    private Map<String, Object> roleSnapshot(IdentityRole role) {
        return roleSnapshot(role, compositeNames(role.name()));
    }

    private static Map<String, Object> roleSnapshot(IdentityRole role, Set<String> permissions) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("name", role.name());
        snapshot.put("description", role.description());
        snapshot.put("portal", applicationOf(permissions).map(PortalApplication::id).orElse(null));
        return snapshot;
    }

    private static IamRoleViews.Permission permissionView(IdentityRole permission) {
        String name = permission.name();
        int separator = name.lastIndexOf(':');
        String resource = separator > 0 ? name.substring(0, separator) : name;
        String action = separator > 0 ? name.substring(separator + 1) : "";
        return new IamRoleViews.Permission(name, permission.description(), resource, action, isSystemPermission(name));
    }

    private static List<IamRoleViews.Permission> permissionViews(List<IdentityRole> permissions) {
        return permissions.stream().map(IamRoleAdministrationService::permissionView)
                .sorted(Comparator.comparing(IamRoleViews.Permission::name)).toList();
    }

    private static Map<String, Object> permissionSnapshot(IdentityRole permission) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("name", permission.name());
        snapshot.put("description", permission.description());
        return snapshot;
    }

    private static Set<String> permissionNames(List<IdentityRole> permissions) {
        return permissions.stream().map(IdentityRole::name).collect(Collectors.toCollection(TreeSet::new));
    }

    private static Set<String> difference(Set<String> left, Set<String> right) {
        Set<String> result = new TreeSet<>(left);
        result.removeAll(right);
        return result;
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
