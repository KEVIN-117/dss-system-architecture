package uatf.dss.authservice.adapter.in.web;

import org.junit.jupiter.api.Test;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import uatf.dss.authservice.application.port.in.GetUserAcademicScopeCommand;
import uatf.dss.authservice.application.port.in.GetUserAcademicScopeUseCase;
import uatf.dss.authservice.application.port.in.UserAcademicScope;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = InternalAcademicScopeController.class)
class InternalAcademicScopeControllerTest extends BaseWebMvcTest {

    private static final String PATH = "/internal/users/{id}/academic-contexts";
    private static final SimpleGrantedAuthority CONTEXT_READER = new SimpleGrantedAuthority("ROLE_CONTEXT_READER");

    @MockitoBean
    private GetUserAcademicScopeUseCase useCase;

    @Test
    void unauthenticatedRequestIsRejected() throws Exception {
        mockMvc.perform(get(PATH, UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
        verify(useCase, never()).execute(any());
    }

    @Test
    void humanRoleWithoutContextReaderIsForbidden() throws Exception {
        mockMvc.perform(get(PATH, UUID.randomUUID())
                        .with(jwt().jwt(token -> token.claim("azp", "olap-service"))
                                .authorities(new SimpleGrantedAuthority("ROLE_SUPERADMIN"))))
                .andExpect(status().isForbidden());
        verify(useCase, never()).execute(any());
    }

    @Test
    void contextReaderFromAnotherClientIsForbidden() throws Exception {
        mockMvc.perform(get(PATH, UUID.randomUUID())
                        .with(jwt().jwt(token -> token.claim("azp", "uatf-dss-spa")).authorities(CONTEXT_READER)))
                .andExpect(status().isForbidden());
        verify(useCase, never()).execute(any());
    }

    @Test
    void contextReaderWithoutAuthorizedPartyIsForbidden() throws Exception {
        mockMvc.perform(get(PATH, UUID.randomUUID())
                        .with(jwt().authorities(CONTEXT_READER)))
                .andExpect(status().isForbidden());
        verify(useCase, never()).execute(any());
    }

    @Test
    void olapServiceAccountReadsScopeWithoutPersonalData() throws Exception {
        UUID keycloakId = UUID.randomUUID();
        when(useCase.execute(new GetUserAcademicScopeCommand(keycloakId))).thenReturn(new UserAcademicScope(
                keycloakId, true, List.of("DECANO"), List.of(new UserAcademicScope.Context(3, null))));

        mockMvc.perform(get(PATH, keycloakId)
                        .with(jwt().jwt(token -> token.claim("azp", "olap-service")).authorities(CONTEXT_READER)))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.keycloakId").value(keycloakId.toString()))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.roles[0]").value("DECANO"))
                .andExpect(jsonPath("$.contexts[0].facultyId").value(3))
                .andExpect(jsonPath("$.contexts[0].careerId").doesNotExist())
                .andExpect(jsonPath("$.username").doesNotExist())
                .andExpect(jsonPath("$.email").doesNotExist());
    }

    @Test
    void unknownUserIsNotFound() throws Exception {
        when(useCase.execute(any())).thenThrow(new UserNotFoundException());

        mockMvc.perform(get(PATH, UUID.randomUUID())
                        .with(jwt().jwt(token -> token.claim("azp", "olap-service")).authorities(CONTEXT_READER)))
                .andExpect(status().isNotFound());
    }

    @Test
    void malformedSubjectIsBadRequest() throws Exception {
        mockMvc.perform(get(PATH, "not-a-uuid")
                        .with(jwt().jwt(token -> token.claim("azp", "olap-service")).authorities(CONTEXT_READER)))
                .andExpect(status().isBadRequest());
        verify(useCase, never()).execute(any());
    }
}
