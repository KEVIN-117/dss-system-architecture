package uatf.dss.authservice.adapter.in.web;

import org.junit.jupiter.api.Test;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = DemoEndpoint.class)
class DemoEndpointTest extends BaseWebMvcTest {

    @Test
    void whenGetPublic_thenStatus200() throws Exception {
        mockMvc.perform(get("/demo/public"))
                .andExpect(status().isOk());
    }

    @Test
    void whenGetAdminWithoutToken_thenStatus401() throws Exception {
        mockMvc.perform(get("/demo/admin"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void whenGetAdminWithWrongRole_thenStatus403() throws Exception {
        mockMvc.perform(get("/demo/admin")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DIRECTOR"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void whenGetAdminWithSuperAdminRole_thenStatus200() throws Exception {
        mockMvc.perform(get("/demo/admin")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_SUPERADMIN"))))
                .andExpect(status().isOk());
    }
    
    @Test
    void whenGetRectorWithRectorRole_thenStatus200() throws Exception {
        mockMvc.perform(get("/demo/rector")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECTOR"))))
                .andExpect(status().isOk());
    }

    @Test
    void whenGetAdminWithRoleAdmin_thenStatus403() throws Exception {
        mockMvc.perform(get("/demo/admin")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void whenGetRectorWithoutToken_thenStatus401() throws Exception {
        mockMvc.perform(get("/demo/rector"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void whenGetRectorWithRoleRector_thenStatus200() throws Exception {
        mockMvc.perform(get("/demo/rector")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_RECTOR"))))
                .andExpect(status().isOk());
    }

    @Test
    void whenGetRectorWithWrongRole_thenStatus403() throws Exception {
        mockMvc.perform(get("/demo/rector")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DECANO"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void whenGetDecanoWithoutToken_thenStatus401() throws Exception {
        mockMvc.perform(get("/demo/decano"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void whenGetDecantWithRoleDecano_thenStatus200() throws Exception {
        mockMvc.perform(get("/demo/decano")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DECANO"))))
                .andExpect(status().isOk());
    }

    @Test
    void whenGetDirectorWithoutToken_thenStatus401() throws Exception {
        mockMvc.perform(get("/demo/director"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void whenGetDirectorWithRoleDirector_thenStatus200() throws Exception {
        mockMvc.perform(get("/demo/director")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DIRECTOR"))))
                .andExpect(status().isOk());
    }
}
