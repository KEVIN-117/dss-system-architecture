package uatf.dss.authservice.domain.model;

import java.util.Collection;

/**
 * Academic scope of a user, derived from their effective permissions (composite client roles of
 * {@code dss-permissions}) and never from a role name. Same precedence as the BFF's {@code deriveAcademicScope}.
 */
public enum AcademicScope {
    /** {@code analytics:global}: sees every faculty, takes no academic context. */
    GLOBAL,
    /** {@code analytics:faculty}: one or more faculties. */
    FACULTY,
    /** {@code analytics:career}: one or more careers (faculty and career). */
    CAREER,
    /** Neither analytics permission: takes no academic context. */
    NONE;

    public static final String PERMISSION_GLOBAL = "analytics:global";
    public static final String PERMISSION_FACULTY = "analytics:faculty";
    public static final String PERMISSION_CAREER = "analytics:career";

    /** First match wins: global, then faculty, then career, otherwise none. */
    public static AcademicScope fromPermissions(Collection<String> permissionNames) {
        if (permissionNames == null) {
            return NONE;
        }
        if (permissionNames.contains(PERMISSION_GLOBAL)) {
            return GLOBAL;
        }
        if (permissionNames.contains(PERMISSION_FACULTY)) {
            return FACULTY;
        }
        if (permissionNames.contains(PERMISSION_CAREER)) {
            return CAREER;
        }
        return NONE;
    }
}
