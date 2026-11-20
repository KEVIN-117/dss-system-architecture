package uatf.dss.authservice.application.service;

import uatf.dss.authservice.application.port.in.IamRoleAdministrationUseCase;
import uatf.dss.authservice.application.port.in.IamRoleCommands;
import uatf.dss.authservice.application.port.in.IamRoleViews;
import uatf.dss.authservice.application.port.out.IdentityRoleAdminPort;
import uatf.dss.authservice.domain.exception.conflict.IamRuleViolationException;
import uatf.dss.authservice.domain.exception.notfound.IdentityResourceNotFoundException;
import uatf.dss.authservice.domain.exception.validation.ValidationException;
import uatf.dss.authservice.domain.model.KeycloakBuiltInRoles;
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
 * </ul>
 */
public class IamRoleAdministrationService implements IamRoleAdministrationUseCase {

    public static final Set<String> SYSTEM_ROLES = Set.of("SUPERADMIN", "RECTOR", "DECANO", "DIRECTOR");
    static final Pattern ROLE_NAME = Pattern.compile("^[A-Z][A-Z0-9_]{1,49}$");
    static final Pattern PORTAL = Pattern.compile("^[a-z][a-z0-9-]{0,49}$");
    static final Pattern PERMISSION_NAME = Pattern.compile("^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)+$");
    static final int MAX_PERMISSION_NAME = 100;
    private static final String PORTAL_ATTRIBUTE = "portal";
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
                .map(IamRoleAdministrationService::roleView)
                .sorted(Comparator.comparing(IamRoleViews.Role::name))
                .toList();
    }

    @Override
    public IamRoleViews.Role getRole(String name) {
        return roleView(realmRole(name));
    }

    @Override
    public IamRoleViews.Role createRole(IamRoleCommands.CreateRole command) {
        String name = trim(command.name());
        String portal = blankToNull(command.portal());
        IdentityRoleDraft draft = new IdentityRoleDraft(name, blankToNull(command.description()), portalAttributes(Map.of(), portal));
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
                    validatePortal(portal);
                    roles.createRealmRole(draft);
                    return realmRole(name);
                },
                IamRoleAdministrationService::roleSnapshot);
        return getRole(name);
    }

    @Override
    public IamRoleViews.Role updateRole(IamRoleCommands.UpdateRole command) {
        String name = trim(command.name());
        IdentityRole current = realmRole(name);
        IdentityRole updated = audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "ROLE_UPDATED", AuditTargetType.ROLE, name,
                        () -> roleSnapshot(current)),
                () -> {
                    String portal = command.portal() == null ? portalOf(current) : blankToNull(command.portal());
                    validatePortal(portal);
                    String description = command.description() == null
                            ? current.description() : blankToNull(command.description());
                    roles.updateRealmRole(name, new IdentityRoleDraft(name, description,
                            portalAttributes(current.attributes(), portal)));
                    return realmRole(name);
                },
                IamRoleAdministrationService::roleSnapshot);
        return roleView(updated);
    }

    @Override
    public void deleteRole(IamRoleCommands.DeleteRole command) {
        String name = trim(command.name());
        IdentityRole current = realmRole(name);
        audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "ROLE_DELETED", AuditTargetType.ROLE, name,
                        () -> {
                            Map<String, Object> before = roleSnapshot(current);
                            before.put("permissions", permissionNames(roles.listRealmRoleClientComposites(name, permissionsClientId)));
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

        audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "ROLE_PERMISSIONS_REPLACED", AuditTargetType.ROLE,
                        roleName, () -> Map.of("permissions", List.copyOf(current))),
                () -> {
                    Set<String> toAdd = difference(requested, current);
                    Set<String> toRemove = difference(current, requested);
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
        List<IamRoleViews.Role> roleViews = listRoles();
        Map<String, List<String>> grants = new LinkedHashMap<>();
        for (IamRoleViews.Role role : roleViews) {
            grants.put(role.name(), List.copyOf(permissionNames(
                    roles.listRealmRoleClientComposites(role.name(), permissionsClientId))));
        }
        return new IamRoleViews.Matrix(roleViews, listPermissions(), grants);
    }

    // ---- helpers -------------------------------------------------------------------------------------------

    public static boolean isSystemRole(String name) {
        return SYSTEM_ROLES.contains(name) || KeycloakBuiltInRoles.isBuiltIn(name);
    }

    public static boolean isSystemPermission(String name) {
        return name.startsWith(IAM_PREFIX) || CONTEXT_READ.equals(name);
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

    private static void validatePortal(String portal) {
        if (portal != null && !PORTAL.matcher(portal).matches()) {
            throw new ValidationException("Portal inválido: usa minúsculas, números y guion, por ejemplo rector.");
        }
    }

    /** Keeps every other attribute and sets or removes {@code portal}. */
    private static Map<String, List<String>> portalAttributes(Map<String, List<String>> current, String portal) {
        Map<String, List<String>> attributes = new HashMap<>(current == null ? Map.of() : current);
        if (portal == null) {
            attributes.remove(PORTAL_ATTRIBUTE);
        } else {
            attributes.put(PORTAL_ATTRIBUTE, List.of(portal));
        }
        return attributes;
    }

    private static String portalOf(IdentityRole role) {
        List<String> values = role.attributes().get(PORTAL_ATTRIBUTE);
        return values == null || values.isEmpty() ? null : values.getFirst();
    }

    private static IamRoleViews.Role roleView(IdentityRole role) {
        return new IamRoleViews.Role(role.name(), role.description(), portalOf(role), isSystemRole(role.name()));
    }

    private static Map<String, Object> roleSnapshot(IdentityRole role) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("name", role.name());
        snapshot.put("description", role.description());
        snapshot.put("portal", portalOf(role));
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
