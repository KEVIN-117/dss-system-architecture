package uatf.dss.authservice.adapter.in.web;

import org.junit.jupiter.api.Test;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import uatf.dss.authservice.application.port.in.AcademicCatalog;
import uatf.dss.authservice.application.port.in.ListAcademicCatalogUseCase;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AcademicCatalogController.class)
class AcademicCatalogControllerTest extends BaseWebMvcTest {

    @MockitoBean
    private ListAcademicCatalogUseCase useCase;

    @Test
    void requiresUsersReadPermission() throws Exception {
        mockMvc.perform(get("/admin/academic-catalog")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_SUPERADMIN"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void returnsTheCatalogWithUsersReadPermission() throws Exception {
        when(useCase.execute()).thenReturn(new AcademicCatalog(
                List.of(new AcademicCatalog.Faculty(10, "Ingeniería")),
                List.of(new AcademicCatalog.Career("025", "Sistemas", 10))));

        mockMvc.perform(get("/admin/academic-catalog")
                        .with(jwt().authorities(new SimpleGrantedAuthority("iam:users:read"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.faculties[0].name").value("Ingeniería"))
                .andExpect(jsonPath("$.careers[0].id").value("025"));
    }
}
