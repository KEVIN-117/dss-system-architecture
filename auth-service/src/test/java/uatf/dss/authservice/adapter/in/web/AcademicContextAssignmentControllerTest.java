package uatf.dss.authservice.adapter.in.web;

import org.junit.jupiter.api.Test;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsCommand;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsUseCase;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = AcademicContextAssignmentController.class)
class AcademicContextAssignmentControllerTest extends BaseWebMvcTest {

    @MockitoBean
    private SetUserAcademicContextsUseCase useCase;

    @Test
    void unauthenticatedRequestIsRejected() throws Exception {
        mockMvc.perform(put("/admin/users/{id}/academic-contexts", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"contexts\":[]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void callerWithoutSuperadminAuthorityIsForbidden() throws Exception {
        mockMvc.perform(put("/admin/users/{id}/academic-contexts", UUID.randomUUID())
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DIRECTOR")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"contexts\":[]}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void superadminCanReplaceContextsAndActorIsTakenFromJwt() throws Exception {
        UUID actorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        UUID contextId = UUID.randomUUID();
        when(useCase.execute(any())).thenReturn(List.of(new UserAcademicContext(contextId, targetId, 10, "025")));

        mockMvc.perform(put("/admin/users/{id}/academic-contexts", targetId)
                        .with(jwt().jwt(token -> token.subject(actorId.toString()))
                                .authorities(new SimpleGrantedAuthority("ROLE_SUPERADMIN")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contexts\":[{\"facultyId\":10,\"careerId\":\"025\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].facultyId").value(10))
                .andExpect(jsonPath("$[0].careerId").value("025"));

        verify(useCase).execute(new SetUserAcademicContextsCommand(actorId, targetId,
                List.of(new SetUserAcademicContextsCommand.AcademicContextInput(10, "025"))));
    }

    @Test
    void portalCanPreflightPutRequest() throws Exception {
        mockMvc.perform(options("/admin/users/{id}/academic-contexts", UUID.randomUUID())
                        .header("Origin", "http://localhost:3001")
                        .header("Access-Control-Request-Method", "PUT"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3001"));
    }
}
