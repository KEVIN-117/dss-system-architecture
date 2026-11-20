package uatf.dss.authservice.domain.model.audit;

/** Kind of resource an administrative operation acts on. */
public enum AuditTargetType {
    USER,
    ROLE,
    PERMISSION,
    CLIENT
}
