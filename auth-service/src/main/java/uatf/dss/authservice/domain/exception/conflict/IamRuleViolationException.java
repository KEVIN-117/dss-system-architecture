package uatf.dss.authservice.domain.exception.conflict;

/**
 * An administrative change would break an institutional rule: an administrator disabling their own account, or the
 * last enabled SUPERADMIN losing the role or being disabled. Maps to 409.
 */
public class IamRuleViolationException extends ConflictException {
    public IamRuleViolationException(String message) {
        super(message);
    }
}
