package uatf.dss.authservice.application.port.in;

import java.util.List;

/**
 * Manages realm roles, the permission catalog and which permissions each role groups (IAM-007). Every write is
 * audited (IAM-005). Changes reach users on their next token.
 */
public interface IamRoleAdministrationUseCase {

    List<IamRoleViews.Role> listRoles();

    IamRoleViews.Role getRole(String name);

    IamRoleViews.Role createRole(IamRoleCommands.CreateRole command);

    IamRoleViews.Role updateRole(IamRoleCommands.UpdateRole command);

    void deleteRole(IamRoleCommands.DeleteRole command);

    List<IamRoleViews.Permission> getRolePermissions(String roleName);

    List<IamRoleViews.Permission> replaceRolePermissions(IamRoleCommands.ReplaceRolePermissions command);

    List<IamRoleViews.Permission> listPermissions();

    IamRoleViews.Permission createPermission(IamRoleCommands.CreatePermission command);

    IamRoleViews.Permission updatePermission(IamRoleCommands.UpdatePermission command);

    void deletePermission(IamRoleCommands.DeletePermission command);

    IamRoleViews.Matrix matrix();
}
