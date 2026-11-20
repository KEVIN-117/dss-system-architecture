package uatf.dss.authservice.application.port.in;

import java.util.List;

/**
 * Manages applications (OAuth clients) from the admin portal (IAM-008). Every write is audited (IAM-005); secrets
 * are returned once and never stored in the audit log or written to logs.
 */
public interface IamClientAdministrationUseCase {

    List<IamClientViews.Client> listClients(String search, int page, int size);

    IamClientViews.Client getClient(String clientId);

    IamClientViews.CreatedClient createClient(IamClientCommands.CreateClient command);

    IamClientViews.Client updateClient(IamClientCommands.UpdateClient command);

    IamClientViews.IssuedSecret rotateSecret(IamClientCommands.RotateSecret command);
}
