package uatf.dss.authservice.application.port.in;

import uatf.dss.authservice.domain.model.audit.AuditActor;

import java.util.UUID;

/**
 * Keeps the local copy of users and roles aligned with Keycloak beyond what a single user event carries (IAM-010):
 * deleted users, role changes that ripple to every holder, and a full resynchronization to recover from drift.
 */
public interface IdentitySyncUseCase {

    /** The user was deleted in Keycloak: logical deletion of the local copy. Returns whether a local user existed. */
    boolean removeLocalUser(UUID keycloakId);

    /** Re-reads from Keycloak every local user whose effective realm roles may have changed. Returns how many. */
    int resyncAfterRoleChange(RoleChangeNotice change);

    /** Re-reads every Keycloak user and logically deletes local users that no longer exist there. Audited. */
    ResyncReport resyncAll(AuditActor actor);

    /** What changed on a role, as published by the webhook. */
    record RoleChangeNotice(String name, boolean clientRole, String clientId, Change change, boolean affectsRealmRoles) {
        public enum Change { COMPOSITES_ADDED, COMPOSITES_REMOVED, UPDATED, DELETED }
    }

    /**
     * @param scanned users read from Keycloak
     * @param synced  local copies created or refreshed
     * @param skipped Keycloak users that break the local rules (for example without e-mail); logged, not removed
     * @param removed local users logically deleted because Keycloak no longer has them
     */
    record ResyncReport(int scanned, int synced, int skipped, int removed) {}
}
