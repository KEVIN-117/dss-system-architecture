package uatf.dss.authservice.application.port.in;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Responses of {@link IamUserAdministrationUseCase}. Identity provider ids and credentials are never exposed. */
public final class IamUserViews {

    private IamUserViews() {
    }

    /**
     * @param invitationSent only set on creation: {@code false} when the user was created but the invitation e-mail
     *                       could not be sent (it can be resent with the actions-email endpoint)
     */
    public record IamUser(
            UUID id,
            String username,
            String email,
            String firstName,
            String lastName,
            boolean enabled,
            boolean emailVerified,
            Instant createdAt,
            Boolean invitationSent) {
    }

    public record IamRole(String name, String description) {
    }

    /**
     * @param direct    assigned to the user itself
     * @param effective direct plus everything inherited through composite roles
     */
    public record IamAssignments(List<IamRole> direct, List<IamRole> effective) {
    }
}
