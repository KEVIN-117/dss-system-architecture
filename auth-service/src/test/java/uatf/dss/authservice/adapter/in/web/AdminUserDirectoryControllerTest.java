package uatf.dss.authservice.adapter.in.web;

import org.junit.jupiter.api.Test;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import uatf.dss.authservice.application.port.in.AdminUserDirectoryEntry;
import uatf.dss.authservice.application.port.in.AdminUserDirectoryPage;
import uatf.dss.authservice.application.port.in.GetAdminUserByIdUseCase;
import uatf.dss.authservice.application.port.in.ListAdminUsersQuery;
import uatf.dss.authservice.application.port.in.ListAdminUsersUseCase;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AdminUserDirectoryController.class)
class AdminUserDirectoryControllerTest extends BaseWebMvcTest {

    @MockitoBean
    private ListAdminUsersUseCase listUsers;

    @MockitoBean
    private GetAdminUserByIdUseCase getUser;

    @Test
    void listRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/admin/users")).andExpect(status().isUnauthorized());
    }

    @Test
    void listRequiresSuperadmin() throws Exception {
        mockMvc.perform(get("/admin/users").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DIRECTOR"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void listReturnsPagedSafeDirectoryAndPassesFilters() throws Exception {
        UUID id = UUID.randomUUID();
        AdminUserDirectoryEntry entry = new AdminUserDirectoryEntry(id, "selene", "selene@uatf.edu.bo", "Selene", "Rojas", true,
                List.of("SUPERADMIN"), List.of());
        when(listUsers.execute(any(ListAdminUsersQuery.class)))
                .thenReturn(new AdminUserDirectoryPage(List.of(entry), 1, 10, 21, 3));

        mockMvc.perform(get("/admin/users")
                        .param("q", "selene")
                        .param("active", "true")
                        .param("role", "SUPERADMIN")
                        .param("facultyId", "4")
                        .param("careerId", "INF")
                        .param("page", "1")
                        .param("size", "10")
                        .with(superadmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(id.toString()))
                .andExpect(jsonPath("$.content[0].username").value("selene"))
                .andExpect(jsonPath("$.content[0].roles[0]").value("SUPERADMIN"))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").value(21))
                .andExpect(jsonPath("$.content[0].keycloakId").doesNotExist())
                .andExpect(jsonPath("$.content[0].password").doesNotExist());

        verify(listUsers).execute(new ListAdminUsersQuery("selene", true, "SUPERADMIN", 4, "INF", 1, 10));
    }

    @Test
    void listRejectsInvalidPaginationAndFilters() throws Exception {
        mockMvc.perform(get("/admin/users").param("page", "-1").with(superadmin()))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/admin/users").param("size", "101").with(superadmin()))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/admin/users").param("careerId", "TOOLONG").with(superadmin()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void detailReturnsSafeUserForSuperadmin() throws Exception {
        UUID id = UUID.randomUUID();
        when(getUser.execute(id)).thenReturn(new AdminUserDirectoryEntry(id, "selene", "selene@uatf.edu.bo", "Selene", "Rojas", true,
                List.of("SUPERADMIN"), List.of()));

        mockMvc.perform(get("/admin/users/{id}", id).with(superadmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.email").value("selene@uatf.edu.bo"))
                .andExpect(jsonPath("$.keycloakId").doesNotExist());
    }

    @Test
    void detailRequiresSuperadmin() throws Exception {
        mockMvc.perform(get("/admin/users/{id}", UUID.randomUUID())
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DIRECTOR"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void detailReturns404WhenUserDoesNotExist() throws Exception {
        UUID id = UUID.randomUUID();
        when(getUser.execute(id)).thenThrow(new UserNotFoundException());
        mockMvc.perform(get("/admin/users/{id}", id).with(superadmin()))
                .andExpect(status().isNotFound());
    }

    @Test
    void detailRejectsMalformedLocalUuid() throws Exception {
        mockMvc.perform(get("/admin/users/not-a-uuid").with(superadmin()))
                .andExpect(status().isBadRequest());
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor superadmin() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_SUPERADMIN"));
    }
}
