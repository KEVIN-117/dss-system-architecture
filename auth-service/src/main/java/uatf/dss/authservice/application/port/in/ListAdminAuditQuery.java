package uatf.dss.authservice.application.port.in;

import uatf.dss.authservice.domain.model.audit.AuditOutcome;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;

import java.time.Instant;

/**
 * Filters for the administrative audit log. Every filter is optional; {@code from} is inclusive and {@code to}
 * exclusive. {@code actor} matches the actor's Keycloak id or username exactly.
 */
public record ListAdminAuditQuery(
        String actor,
        String action,
        AuditTargetType targetType,
        String targetId,
        AuditOutcome outcome,
        Instant from,
        Instant to,
        int page,
        int size) {
}
