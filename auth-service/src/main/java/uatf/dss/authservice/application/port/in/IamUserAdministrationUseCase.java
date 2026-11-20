package uatf.dss.authservice.application.port.in;

import java.util.UUID;

/**
 * Manages users in Keycloak from the admin portal (IAM-006). Every write is audited (IAM-005) and refreshes the
 * local user copy immediately, without waiting for the Keycloak event.
 */
public interface IamUserAdministrationUseCase {

    IamUserViews.IamUser createUser(IamUserCommands.CreateUser command);

    IamUserViews.IamUser updateUser(IamUserCommands.UpdateUser command);

    void sendActionsEmail(IamUserCommands.SendActionsEmail command);

    IamUserViews.IamAssignments getRoles(UUID userId);

    IamUserViews.IamAssignments replaceRoles(IamUserCommands.ReplaceRoles command);

    IamUserViews.IamAssignments getPermissions(UUID userId);

    IamUserViews.IamAssignments replacePermissions(IamUserCommands.ReplacePermissions command);
}
