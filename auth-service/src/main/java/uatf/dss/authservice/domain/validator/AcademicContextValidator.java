package uatf.dss.authservice.domain.validator;

import uatf.dss.authservice.domain.exception.validation.InvalidAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidDeanAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidDirectorAcademicContextException;
import uatf.dss.authservice.domain.exception.validation.InvalidRectorAcademicContextException;
import uatf.dss.authservice.domain.model.AcademicScope;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Academic-scope rules (RNF4.1, decision D2 of the IAM epic), driven by the user's effective permissions
 * ({@link AcademicScope}), not by role names.
 *
 * <ul>
 *   <li>GLOBAL ({@code analytics:global}) and NONE (no faculty/career permission): no contexts.</li>
 *   <li>FACULTY ({@code analytics:faculty}) has one or more faculties (faculty only, no career).</li>
 *   <li>CAREER ({@code analytics:career}) has one or more careers (faculty and career).</li>
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
    public static void validateAll(List<UserAcademicContext> contexts, AcademicScope scope) {
        Objects.requireNonNull(contexts, "contexts");
        Objects.requireNonNull(scope, "scope");
        switch (scope) {
            case GLOBAL -> {
                if (!contexts.isEmpty()) {
                    throw new InvalidAcademicContextException(
                            "The user has global scope (analytics:global) and takes no academic context.");
                }
            }
            case NONE -> {
                if (!contexts.isEmpty()) {
                    throw new InvalidAcademicContextException(
                            "The user has no faculty/career analytics permission (analytics:faculty or "
                                    + "analytics:career), so it takes no academic context.");
                }
            }
            case FACULTY, CAREER -> {
                if (contexts.isEmpty()) {
                    throw new InvalidAcademicContextException(
                            "Scope " + scope + " requires at least one academic context.");
                }
                if (contexts.size() > MAX_CONTEXTS) {
                    throw new InvalidAcademicContextException(
                            "A user can hold at most " + MAX_CONTEXTS + " academic contexts.");
                }
            }
        }
        Set<String> seen = new HashSet<>();
        for (UserAcademicContext context : contexts) {
            validate(context, scope);
            if (!seen.add(context.facultyId() + "/" + context.careerId())) {
                throw new InvalidAcademicContextException(
                        "Duplicate academic context: faculty " + context.facultyId()
                                + (context.careerId() == null ? "" : ", career " + context.careerId()) + ".");
            }
        }
    }

    /** Validates the shape of a single context for the given scope. */
    public static void validate(UserAcademicContext context, AcademicScope scope){
        if (context == null || scope == null)
            return;
        switch (scope){
            case GLOBAL, NONE -> {
                if (context.facultyId() != null || context.careerId() != null){
                    throw new InvalidRectorAcademicContextException();
                }
            }
            case FACULTY -> {
                if (context.facultyId() == null || context.careerId() != null){
                    throw new InvalidDeanAcademicContextException();
                }
            }
            case CAREER -> {
                if (context.facultyId() == null || context.careerId() == null){
                    throw new InvalidDirectorAcademicContextException();
                }
            }
        }
    }
}
