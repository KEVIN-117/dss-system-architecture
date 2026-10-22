package uatf.dss.authservice.application.port.in;

import java.util.List;

public record AdminUserDirectoryPage(
        List<AdminUserDirectoryEntry> content,
        int page,
        int size,
        long totalElements,
        int totalPages) {
}
