package uatf.dss.authservice.application.port.in;

import java.util.List;
import java.util.UUID;

public record SetUserAcademicContextsCommand(
        UUID actorKeycloakId,
        UUID targetUserId,
        List<AcademicContextInput> contexts
) {
    public SetUserAcademicContextsCommand {
        contexts = List.copyOf(contexts);
    }

    public record AcademicContextInput(Integer facultyId, String careerId) {}
}
