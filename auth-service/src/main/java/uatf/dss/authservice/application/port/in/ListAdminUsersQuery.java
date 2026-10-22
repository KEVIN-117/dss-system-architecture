package uatf.dss.authservice.application.port.in;

public record ListAdminUsersQuery(
        String query,
        Boolean active,
        String role,
        Integer facultyId,
        String careerId,
        int page,
        int size) {
}
