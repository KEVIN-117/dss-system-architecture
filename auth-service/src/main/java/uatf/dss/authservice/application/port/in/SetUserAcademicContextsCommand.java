package uatf.dss.authservice.application.port.in;

import uatf.dss.authservice.domain.model.audit.AuditActor;

import java.util.List;
import java.util.UUID;

/** {@code actor} identifies who makes the change, for the audit log (IAM-005). */
public record SetUserAcademicContextsCommand(
        AuditActor actor,
        UUID targetUserId,
        List<AcademicContextInput> contexts
) {
    public SetUserAcademicContextsCommand {
        contexts = List.copyOf(contexts);
    }

    public record AcademicContextInput(Integer facultyId, String careerId) {}
}
