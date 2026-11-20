package uatf.dss.authservice.application.port.in;

import uatf.dss.authservice.domain.model.audit.AdminAuditEntry;

import java.util.List;

/** A page of audit entries, newest first. Same shape as {@link AdminUserDirectoryPage}. */
public record AdminAuditPage(
        List<AdminAuditEntry> content,
        int page,
        int size,
        long totalElements,
        int totalPages) {
}
