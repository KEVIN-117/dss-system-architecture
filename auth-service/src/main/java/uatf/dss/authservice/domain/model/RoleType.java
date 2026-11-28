package uatf.dss.authservice.domain.model;

/**
 * The system (non-deletable) roles. It no longer decides academic-context rules: those come from the user's
 * effective permissions (see {@link AcademicScope}).
 */
public enum RoleType {
    SUPERADMIN,
    RECTOR,
    DECANO,
    DIRECTOR
}