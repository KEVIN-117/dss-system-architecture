package uatf.dss.authservice.application.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import uatf.dss.authservice.application.port.in.IdentitySyncUseCase;
import uatf.dss.authservice.application.port.in.KeycloakRoleSnapshot;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;
import uatf.dss.authservice.application.port.out.IdentityRoleAdminPort;
import uatf.dss.authservice.application.port.out.IdentityRoleMappingPort;
import uatf.dss.authservice.application.port.out.IdentityUserAdminPort;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.exception.upstream.IdentityProviderException;
import uatf.dss.authservice.domain.exception.validation.ValidationException;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;
import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.identity.IdentityUser;

import java.time.Clock;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static net.logstash.logback.argument.StructuredArguments.kv;

/**
 * Reconciles the local read model with Keycloak (IAM-010). The local role snapshot holds the <em>effective</em> realm
 * roles of each user (composites and groups expanded), which is what the JWT carries, so every decision auth-service
 * makes from it (academic-scope precedence, the internal scope endpoint) matches the token.
 */
public class IdentitySyncService implements IdentitySyncUseCase {

    static final String RESYNC_AUDIT_ACTION = "USERS_RESYNCED";
    static final int PAGE_SIZE = 100;

    private static final Logger AUDIT_LOGGER = LoggerFactory.getLogger("AUDIT_LOGGER");
    private static final Logger log = LoggerFactory.getLogger(IdentitySyncService.class);

    private final IdentityUserAdminPort users;
    private final IdentityRoleAdminPort roles;
    private final IdentityRoleMappingPort mappings;
    private final UserRepository localUsers;
    private final SyncUserUseCase syncUser;
    private final AdminAuditRecorder audit;
    private final Clock clock;

    public IdentitySyncService(IdentityUserAdminPort users, IdentityRoleAdminPort roles,
                               IdentityRoleMappingPort mappings, UserRepository localUsers, SyncUserUseCase syncUser,
                               AdminAuditRecorder audit, Clock clock) {
        this.users = users;
        this.roles = roles;
        this.mappings = mappings;
        this.localUsers = localUsers;
        this.syncUser = syncUser;
        this.audit = audit;
        this.clock = clock;
    }

    @Override
    public boolean removeLocalUser(UUID keycloakId) {
        boolean removed = localUsers.markDeleted(keycloakId, clock.instant());
        AUDIT_LOGGER.info("Usuario eliminado en Keycloak",
                kv("event_type", "USER_DELETED_SYNCED"),
                kv("keycloak_id", keycloakId),
                kv("local_user_found", removed));
        return removed;
    }

    @Override
    public int resyncAfterRoleChange(RoleChangeNotice change) {
        if (!change.affectsRealmRoles()) {
            return 0; // Only permissions (client roles) changed: the local realm-role snapshot is unaffected.
        }
        Set<UUID> targets = new LinkedHashSet<>();
        if (change.clientRole()) {
            // The local snapshot only holds realm roles; a client role matters when it has realm composites.
            // Its direct holders are re-read; deeper chains are left to the full resync.
            if (change.clientId() != null && change.name() != null && change.change() != RoleChangeNotice.Change.DELETED) {
                forEachPage((first, max) -> roles.listUsersWithClientRole(change.clientId(), change.name(), first, max),
                        user -> targets.add(UUID.fromString(user.id())));
            }
        } else {
            if (change.name() != null && isCompositesChange(change.change())) {
                // The snapshot is effective, so this also covers users who get the role through another composite.
                targets.addAll(localUsers.findKeycloakIdsByRoleNames(Set.of(change.name())));
            }
            if (change.name() == null || !isCompositesChange(change.change())) {
                // Deleted or renamed: whoever still holds a role name that Keycloak no longer has is out of date.
                targets.addAll(localUsers.findKeycloakIdsByRoleNames(staleRoleNames()));
            }
        }
        targets.forEach(this::resyncUser);
        log.info("Cambio de rol sincronizado: role={}, change={}, users={}", change.name(), change.change(),
                targets.size());
        return targets.size();
    }

    @Override
    public ResyncReport resyncAll(AuditActor actor) {
        return audit.recordRemote(
                new AdminAuditRecorder.Operation(actor, RESYNC_AUDIT_ACTION, AuditTargetType.USER, "*", null),
                this::resyncEveryUser,
                report -> Map.of("scanned", report.scanned(), "synced", report.synced(), "skipped", report.skipped(),
                        "removed", report.removed()));
    }

    private ResyncReport resyncEveryUser() {
        Set<UUID> seen = new HashSet<>();
        int[] synced = {0};
        int[] skipped = {0};
        forEachPage((first, max) -> users.searchUsers(null, first, max), user -> {
            seen.add(UUID.fromString(user.id())); // seen even if skipped: it exists, so it is never removed
            if (sync(user)) {
                synced[0]++;
            } else {
                skipped[0]++;
            }
        });
        long expected = users.countUsers(null);
        if (seen.size() != expected) {
            // Users were added or removed while paging: deleting on a partial view could drop live users.
            throw new IdentityProviderException("Keycloak cambió durante la resincronización (" + seen.size()
                    + " leídos, " + expected + " contados); vuelve a intentarlo.");
        }
        int removed = 0;
        for (UUID local : localUsers.findLiveKeycloakIds()) {
            if (!seen.contains(local) && removeLocalUser(local)) {
                removed++;
            }
        }
        return new ResyncReport(seen.size(), synced[0], skipped[0], removed);
    }

    private void resyncUser(UUID keycloakId) {
        Optional<IdentityUser> user = users.findUserById(keycloakId.toString());
        if (user.isPresent()) {
            sync(user.get());
        } else {
            removeLocalUser(keycloakId);
        }
    }

    /**
     * Refreshes the local copy. A Keycloak user that breaks the local rules (for example without e-mail, which the
     * local model requires) is skipped and logged instead of failing the whole operation. It is checked before
     * calling {@link SyncUserUseCase}, because an exception inside it would mark the caller's transaction (the event
     * consumer's) for rollback even if caught here. Returns whether the user was synchronized.
     */
    private boolean sync(IdentityUser user) {
        try {
            User.create(null, UUID.fromString(user.id()), user.username(), user.email(), user.firstName(),
                    user.lastName(), user.enabled());
        } catch (ValidationException invalid) {
            log.warn("Usuario de Keycloak omitido en la sincronización: keycloakId={}, motivo={}", user.id(),
                    invalid.getMessage());
            return false;
        }
        List<KeycloakRoleSnapshot> effective = mappings.listUserRealmRoles(user.id(), true).stream()
                .map(role -> new KeycloakRoleSnapshot(role.name(), false))
                .toList();
        syncUser.sync(new SyncUserCommand(UUID.fromString(user.id()), user.username(), user.email(),
                user.firstName(), user.lastName(), user.enabled(), effective));
        return true;
    }

    private Set<String> staleRoleNames() {
        Set<String> existing = roles.listRealmRoles().stream().map(IdentityRole::name).collect(Collectors.toSet());
        Set<String> stale = new HashSet<>(localUsers.findAssignedRoleNames());
        stale.removeAll(existing);
        return stale;
    }

    private static boolean isCompositesChange(RoleChangeNotice.Change change) {
        return change == RoleChangeNotice.Change.COMPOSITES_ADDED || change == RoleChangeNotice.Change.COMPOSITES_REMOVED;
    }

    private static void forEachPage(Page source, java.util.function.Consumer<IdentityUser> action) {
        for (int first = 0; ; first += PAGE_SIZE) {
            List<IdentityUser> page = source.fetch(first, PAGE_SIZE);
            page.forEach(action);
            if (page.size() < PAGE_SIZE) {
                return;
            }
        }
    }

    @FunctionalInterface
    private interface Page {
        List<IdentityUser> fetch(int first, int max);
    }
}
