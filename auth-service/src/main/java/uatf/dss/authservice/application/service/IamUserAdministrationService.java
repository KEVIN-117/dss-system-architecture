package uatf.dss.authservice.application.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import uatf.dss.authservice.application.port.in.IamUserAdministrationUseCase;
import uatf.dss.authservice.application.port.in.IamUserCommands;
import uatf.dss.authservice.application.port.in.IamUserViews;
import uatf.dss.authservice.application.port.in.KeycloakRoleSnapshot;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.application.port.out.IdentityRoleAdminPort;
import uatf.dss.authservice.application.port.out.IdentityRoleMappingPort;
import uatf.dss.authservice.application.port.out.IdentityUserAdminPort;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.exception.DomainException;
import uatf.dss.authservice.domain.exception.conflict.IamRuleViolationException;
import uatf.dss.authservice.domain.exception.notfound.IdentityResourceNotFoundException;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.exception.validation.ValidationException;
import uatf.dss.authservice.domain.model.KeycloakBuiltInRoles;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;
import uatf.dss.authservice.domain.model.identity.IdentityRequiredAction;
import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.identity.IdentityUser;
import uatf.dss.authservice.domain.model.identity.IdentityUserChanges;
import uatf.dss.authservice.domain.model.identity.NewIdentityUser;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Implements {@link IamUserAdministrationUseCase} on the identity ports (Keycloak) with:
 * <ul>
 *     <li>audit of every write through {@link AdminAuditRecorder#recordRemote}, including rule rejections;</li>
 *     <li>institutional rules: nobody disables their own account, and the last enabled SUPERADMIN keeps the role
 *     and stays enabled;</li>
 *     <li>an immediate refresh of the local user copy after each change (the later Keycloak event is idempotent).</li>
 * </ul>
 */
public class IamUserAdministrationService implements IamUserAdministrationUseCase {

    public static final String SUPERADMIN = "SUPERADMIN";
    static final Set<IdentityRequiredAction> INVITATION_ACTIONS =
            Set.of(IdentityRequiredAction.UPDATE_PASSWORD, IdentityRequiredAction.VERIFY_EMAIL);
    private static final int MAX_ROLE_HOLDERS = 1000;
    private static final Logger log = LoggerFactory.getLogger(IamUserAdministrationService.class);

    private final IdentityUserAdminPort users;
    private final IdentityRoleAdminPort roles;
    private final IdentityRoleMappingPort mappings;
    private final UserRepository localUsers;
    private final SyncUserUseCase syncUser;
    private final AdminAuditRecorder audit;
    private final AcademicScopeResolver scopeResolver;
    private final String permissionsClientId;
    private final Duration invitationLifespan;

    public IamUserAdministrationService(IdentityUserAdminPort users, IdentityRoleAdminPort roles,
                                        IdentityRoleMappingPort mappings, UserRepository localUsers,
                                        SyncUserUseCase syncUser, AdminAuditRecorder audit,
                                        AcademicScopeResolver scopeResolver, String permissionsClientId, Duration invitationLifespan) {
        this.users = users;
        this.roles = roles;
        this.mappings = mappings;
        this.localUsers = localUsers;
        this.syncUser = syncUser;
        this.audit = audit;
        this.scopeResolver = scopeResolver;
        this.permissionsClientId = permissionsClientId;
        this.invitationLifespan = invitationLifespan;
    }

    // ---- users ---------------------------------------------------------------------------------------------

    @Override
    public IamUserViews.IamUser createUser(IamUserCommands.CreateUser command) {
        String username = command.username().trim();
        String keycloakId = audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "USER_CREATED", AuditTargetType.USER, username, null),
                () -> users.createUser(new NewIdentityUser(username, command.email().trim(), command.firstName(),
                        command.lastName(), command.enabled(), false)),
                id -> {
                    Map<String, Object> after = new LinkedHashMap<>();
                    after.put("username", username);
                    after.put("email", command.email().trim());
                    after.put("firstName", command.firstName());
                    after.put("lastName", command.lastName());
                    after.put("enabled", command.enabled());
                    return after;
                });

        IdentityUser created = identityUser(keycloakId);
        User local = refreshLocal(created, List.of());

        Boolean invitationSent = null;
        if (command.sendInvitation()) {
            invitationSent = sendInvitationQuietly(command.actor(), local.id(), keycloakId);
        }
        return view(local.id(), created, keycloakId, invitationSent);
    }

    @Override
    public IamUserViews.IamUser updateUser(IamUserCommands.UpdateUser command) {
        String keycloakId = keycloakIdOf(command.userId());
        IdentityUser current = identityUser(keycloakId);
        IdentityUser updated = audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "USER_UPDATED", AuditTargetType.USER,
                        command.userId().toString(), () -> snapshot(current)),
                () -> {
                    if (Boolean.FALSE.equals(command.enabled()) && current.enabled()) {
                        ensureNotSelf(command.actor(), keycloakId);
                        ensureNotLastEnabledSuperadmin(keycloakId);
                    }
                    users.updateUser(keycloakId, new IdentityUserChanges(trimToNull(command.email()),
                            command.firstName(), command.lastName(), command.enabled(), null));
                    return identityUser(keycloakId);
                },
                IamUserAdministrationService::snapshot);
        refreshLocal(updated, null);
        return view(command.userId(), updated, keycloakId, null);
    }

    @Override
    public void sendActionsEmail(IamUserCommands.SendActionsEmail command) {
        if (command.actions().isEmpty()) {
            throw new ValidationException("Indica al menos una acción requerida.");
        }
        String keycloakId = keycloakIdOf(command.userId());
        sendActions(command.actor(), command.userId(), keycloakId, command.actions(),
                command.lifespan() == null ? invitationLifespan : command.lifespan());
    }

    // ---- realm roles ---------------------------------------------------------------------------------------

    @Override
    public IamUserViews.IamAssignments getRoles(UUID userId) {
        return realmRoleAssignments(keycloakIdOf(userId));
    }

    @Override
    public IamUserViews.IamAssignments replaceRoles(IamUserCommands.ReplaceRoles command) {
        String keycloakId = keycloakIdOf(command.userId());
        Set<String> requested = normalize(command.roles());
        requested.stream().filter(KeycloakBuiltInRoles::isBuiltIn).findAny().ifPresent(role -> {
            throw new ValidationException("El rol " + role + " lo administra Keycloak y no se puede asignar.");
        });
        Set<String> current = directRealmRoleNames(keycloakId);

        audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "USER_ROLES_REPLACED", AuditTargetType.USER,
                        command.userId().toString(), () -> Map.of("realmRoles", List.copyOf(current))),
                () -> {
                    Set<String> toAdd = difference(requested, current);
                    Set<String> toRemove = difference(current, requested);
                    if (toRemove.contains(SUPERADMIN)) {
                        ensureNotLastEnabledSuperadmin(keycloakId);
                    }
                    mappings.addUserRealmRoles(keycloakId, toAdd);
                    mappings.removeUserRealmRoles(keycloakId, toRemove);
                    return directRealmRoleNames(keycloakId);
                },
                result -> Map.of("realmRoles", List.copyOf(result)));

        refreshLocal(identityUser(keycloakId), localRoleSnapshot(keycloakId));
        return realmRoleAssignments(keycloakId);
    }

    // ---- permissions ---------------------------------------------------------------------------------------

    @Override
    public IamUserViews.IamAssignments getPermissions(UUID userId) {
        return permissionAssignments(keycloakIdOf(userId));
    }

    @Override
    public IamUserViews.IamAssignments replacePermissions(IamUserCommands.ReplacePermissions command) {
        String keycloakId = keycloakIdOf(command.userId());
        Set<String> requested = normalize(command.permissions());
        Set<String> current = directPermissionNames(keycloakId);

        audit.recordRemote(
                new AdminAuditRecorder.Operation(command.actor(), "USER_PERMISSIONS_REPLACED", AuditTargetType.USER,
                        command.userId().toString(), () -> Map.of("permissions", List.copyOf(current))),
                () -> {
                    mappings.addUserClientRoles(keycloakId, permissionsClientId, difference(requested, current));
                    mappings.removeUserClientRoles(keycloakId, permissionsClientId, difference(current, requested));
                    return directPermissionNames(keycloakId);
                },
                result -> Map.of("permissions", List.copyOf(result)));

        return permissionAssignments(keycloakId);
    }

    // ---- rules ---------------------------------------------------------------------------------------------

    private static void ensureNotSelf(AuditActor actor, String keycloakId) {
        if (actor != null && keycloakId.equals(actor.keycloakId())) {
            throw new IamRuleViolationException("No puedes desactivar tu propia cuenta.");
        }
    }

    /** Fails if {@code keycloakId} holds SUPERADMIN and no other enabled user does. */
    private void ensureNotLastEnabledSuperadmin(String keycloakId) {
        List<IdentityUser> holders = roles.listUsersWithRealmRole(SUPERADMIN, 0, MAX_ROLE_HOLDERS);
        boolean targetHolds = holders.stream().anyMatch(user -> keycloakId.equals(user.id()));
        boolean othersEnabled = holders.stream()
                .anyMatch(user -> !keycloakId.equals(user.id()) && user.enabled());
        if (targetHolds && !othersEnabled) {
            throw new IamRuleViolationException(
                    "Es el último SUPERADMIN habilitado: asigna el rol a otra cuenta antes de quitárselo o desactivarlo.");
        }
    }

    // ---- helpers -------------------------------------------------------------------------------------------

    private boolean sendInvitationQuietly(AuditActor actor, UUID localId, String keycloakId) {
        try {
            sendActions(actor, localId, keycloakId, INVITATION_ACTIONS, invitationLifespan);
            return true;
        } catch (DomainException failure) {
            // The user exists; the failed e-mail is audited and can be resent from the portal.
            log.warn("Usuario {} creado, pero no se pudo enviar la invitación: {}", localId, failure.getMessage());
            return false;
        }
    }

    private void sendActions(AuditActor actor, UUID localId, String keycloakId, Set<IdentityRequiredAction> actions,
                             Duration lifespan) {
        List<String> names = actions.stream().map(Enum::name).sorted().toList();
        audit.recordRemote(
                new AdminAuditRecorder.Operation(actor, "USER_ACTIONS_EMAIL_SENT", AuditTargetType.USER,
                        localId.toString(), null),
                () -> {
                    users.sendRequiredActionsEmail(keycloakId, actions, lifespan);
                    return names;
                },
                sent -> Map.of("actions", sent, "lifespanSeconds", lifespan.toSeconds()));
    }

    private String keycloakIdOf(UUID localId) {
        return localUsers.findById(localId).map(user -> user.keycloakId().toString())
                .orElseThrow(UserNotFoundException::new);
    }

    private IdentityUser identityUser(String keycloakId) {
        return users.findUserById(keycloakId).orElseThrow(() ->
                new IdentityResourceNotFoundException("El usuario no existe en Keycloak."));
    }

    private User refreshLocal(IdentityUser user, List<KeycloakRoleSnapshot> roleSnapshot) {
        return syncUser.sync(new SyncUserCommand(UUID.fromString(user.id()), user.username(), user.email(),
                user.firstName(), user.lastName(), user.enabled(), roleSnapshot));
    }

    /** Effective realm roles, like the token and the webhook's schema-2 snapshot (IAM-010). */
    private List<KeycloakRoleSnapshot> localRoleSnapshot(String keycloakId) {
        return mappings.listUserRealmRoles(keycloakId, true).stream()
                .map(role -> new KeycloakRoleSnapshot(role.name(), false))
                .toList();
    }

    private IamUserViews.IamAssignments realmRoleAssignments(String keycloakId) {
        return new IamUserViews.IamAssignments(
                visible(mappings.listUserRealmRoles(keycloakId, false)),
                visible(mappings.listUserRealmRoles(keycloakId, true)));
    }

    private IamUserViews.IamAssignments permissionAssignments(String keycloakId) {
        return new IamUserViews.IamAssignments(
                views(mappings.listUserClientRoles(keycloakId, permissionsClientId, false)),
                views(mappings.listUserClientRoles(keycloakId, permissionsClientId, true)));
    }

    private Set<String> directRealmRoleNames(String keycloakId) {
        return mappings.listUserRealmRoles(keycloakId, false).stream()
                .map(IdentityRole::name)
                .filter(name -> !KeycloakBuiltInRoles.isBuiltIn(name))
                .collect(Collectors.toCollection(TreeSet::new));
    }

    private Set<String> directPermissionNames(String keycloakId) {
        return mappings.listUserClientRoles(keycloakId, permissionsClientId, false).stream()
                .map(IdentityRole::name)
                .collect(Collectors.toCollection(TreeSet::new));
    }

    private static List<IamUserViews.IamRole> visible(List<IdentityRole> roles) {
        return views(roles.stream().filter(role -> !KeycloakBuiltInRoles.isBuiltIn(role.name())).toList());
    }

    private static List<IamUserViews.IamRole> views(List<IdentityRole> roles) {
        return roles.stream()
                .map(role -> new IamUserViews.IamRole(role.name(), role.description()))
                .sorted(Comparator.comparing(IamUserViews.IamRole::name))
                .toList();
    }

    private static Set<String> normalize(Set<String> names) {
        return names.stream().filter(Objects::nonNull).map(String::trim).filter(name -> !name.isEmpty())
                .collect(Collectors.toCollection(TreeSet::new));
    }

    private static Set<String> difference(Set<String> left, Set<String> right) {
        Set<String> result = new TreeSet<>(left);
        result.removeAll(right);
        return result;
    }

    private static Map<String, Object> snapshot(IdentityUser user) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("username", user.username());
        snapshot.put("email", user.email());
        snapshot.put("firstName", user.firstName());
        snapshot.put("lastName", user.lastName());
        snapshot.put("enabled", user.enabled());
        snapshot.put("emailVerified", user.emailVerified());
        return snapshot;
    }

    private IamUserViews.IamUser view(UUID localId, IdentityUser user, String keycloakId, Boolean invitationSent) {
        return new IamUserViews.IamUser(localId, user.username(), user.email(), user.firstName(), user.lastName(),
                user.enabled(), user.emailVerified(),
                user.createdTimestamp() == null ? null : Instant.ofEpochMilli(user.createdTimestamp()), invitationSent,
                scopeResolver.resolve(keycloakId));
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
