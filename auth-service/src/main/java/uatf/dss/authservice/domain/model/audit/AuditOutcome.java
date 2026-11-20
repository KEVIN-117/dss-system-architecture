package uatf.dss.authservice.domain.model.audit;

/**
 * Result of an audited operation. {@code PENDING} is only used for operations executed in Keycloak: the row is
 * committed before the remote call, so an interrupted operation stays visible instead of disappearing.
 */
public enum AuditOutcome {
    PENDING,
    SUCCESS,
    FAILURE
}
