package uatf.dss.authservice.domain.validator;

import uatf.dss.authservice.domain.exception.validation.InvalidAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidDeanAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidDirectorAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidRectorAcademicContextException;
import uatf.dss.authservice.domain.model.RoleType;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Academic-scope rules (RNF4.1, decision D2 of the IAM epic).
 *
 * <ul>
 *   <li>SUPERADMIN and RECTOR have global scope: no contexts.</li>
 *   <li>DECANO has one or more faculties (faculty only, no career).</li>
 *   <li>DIRECTOR has one or more careers (faculty and career).</li>
 * </ul>
 *
 * A user may hold several contexts (for example an acting dean of two faculties), up to {@link #MAX_CONTEXTS},
 * and never the same one twice.
 */
public class AcademicContextValidator {

    /** Upper bound per user; a real assignment is a handful, this only stops abusive payloads. */
    public static final int MAX_CONTEXTS = 20;

    private AcademicContextValidator() {
    }

    /** Validates the full set of contexts that will replace the user's current ones. */
    public static void validateAll(List<UserAcademicContext> contexts, RoleType role) {
        Objects.requireNonNull(contexts, "contexts");
        Objects.requireNonNull(role, "role");
        switch (role) {
            case SUPERADMIN, RECTOR -> {
                if (!contexts.isEmpty()) {
                    throw new InvalidAcademicContextException(
                            "Role " + role + " has global scope and takes no academic context.");
                }
            }
            case DECANO, DIRECTOR -> {
                if (contexts.isEmpty()) {
                    throw new InvalidAcademicContextException(
                            "Role " + role + " requires at least one academic context.");
                }
                if (contexts.size() > MAX_CONTEXTS) {
                    throw new InvalidAcademicContextException(
                            "A user can hold at most " + MAX_CONTEXTS + " academic contexts.");
                }
            }
        }
        Set<String> seen = new HashSet<>();
        for (UserAcademicContext context : contexts) {
            validate(context, role);
            if (!seen.add(context.facultyId() + "/" + context.careerId())) {
                throw new InvalidAcademicContextException(
                        "Duplicate academic context: faculty " + context.facultyId()
                                + (context.careerId() == null ? "" : ", career " + context.careerId()) + ".");
            }
        }
    }

    /** Validates the shape of a single context for the given role. */
    public static void validate(UserAcademicContext context, RoleType role){
        if (context == null || role == null)
            return;
        switch (role){
            case RECTOR, SUPERADMIN -> {
                if (context.facultyId() != null || context.careerId() != null){
                    throw new InvalidRectorAcademicContextException();
                }
            }
            case DECANO -> {
                if (context.facultyId() == null || context.careerId() != null){
                    throw new InvalidDeanAcademicContextException();
                }
            }
            case DIRECTOR -> {
                if (context.facultyId() == null || context.careerId() == null){
                    throw new InvalidDirectorAcademicContextException();
                }
            }
        }
    }
}
