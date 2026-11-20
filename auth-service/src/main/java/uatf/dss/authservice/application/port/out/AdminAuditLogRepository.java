package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.application.port.in.AdminAuditPage;
import uatf.dss.authservice.application.port.in.ListAdminAuditQuery;
import uatf.dss.authservice.domain.model.audit.AdminAuditEntry;

/**
 * Stores the administrative audit log. The two write modes make the audit trail survive failures:
 * <ul>
 *     <li>{@link #append} joins the caller's transaction, so a successful local change and its audit row commit
 *     or roll back together.</li>
 *     <li>{@link #appendIndependently} and {@link #completeIndependently} commit in their own transaction, so the
 *     row survives a rollback of the caller (failed operations, operations executed in Keycloak).</li>
 * </ul>
 */
public interface AdminAuditLogRepository {

    void append(AdminAuditEntry entry);

    void appendIndependently(AdminAuditEntry entry);

    /** Overwrites outcome, after-state, failure reason and completion time of an existing entry. */
    void completeIndependently(AdminAuditEntry entry);

    AdminAuditPage search(ListAdminAuditQuery query);
}
