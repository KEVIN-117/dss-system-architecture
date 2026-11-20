package uatf.dss.authservice.adapter.in.web;

import uatf.dss.authservice.domain.model.audit.AuditActor;
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
    void callerWithoutUsersWritePermissionIsForbidden() throws Exception {
        mockMvc.perform(put("/admin/users/{id}/academic-contexts", UUID.randomUUID())
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_DIRECTOR")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"contexts\":[]}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void legacySuperadminRoleWithoutPermissionIsForbidden() throws Exception {
        mockMvc.perform(put("/admin/users/{id}/academic-contexts", UUID.randomUUID())
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_SUPERADMIN"),
                                new SimpleGrantedAuthority("iam:users:read")))
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
                        .with(jwt().jwt(token -> token.subject(actorId.toString()).claim("preferred_username", "ana.admin"))
                                .authorities(new SimpleGrantedAuthority("iam:users:write")))
                        .with(request -> {
                            request.setRemoteAddr("10.0.0.5");
                            return request;
                        })
                        .header("X-Forwarded-For", "203.0.113.9, 10.0.0.5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contexts\":[{\"facultyId\":10,\"careerId\":\"025\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].facultyId").value(10))
                .andExpect(jsonPath("$[0].careerId").value("025"));

        verify(useCase).execute(new SetUserAcademicContextsCommand(
                new AuditActor(actorId.toString(), "ana.admin", "203.0.113.9"), targetId,
                List.of(new SetUserAcademicContextsCommand.AcademicContextInput(10, "025"))));
    }

    @Test
    void severalContextsArePassedThroughInOrder() throws Exception {
        UUID targetId = UUID.randomUUID();
        when(useCase.execute(any())).thenReturn(List.of(
                new UserAcademicContext(UUID.randomUUID(), targetId, 5, null),
                new UserAcademicContext(UUID.randomUUID(), targetId, 8, null)));

        mockMvc.perform(put("/admin/users/{id}/academic-contexts", targetId)
                        .with(jwt().authorities(new SimpleGrantedAuthority("iam:users:write")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contexts\":[{\"facultyId\":5},{\"facultyId\":8}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[1].facultyId").value(8));

        verify(useCase).execute(org.mockito.ArgumentMatchers.argThat(command -> command.contexts().equals(List.of(
                new SetUserAcademicContextsCommand.AcademicContextInput(5, null),
                new SetUserAcademicContextsCommand.AcademicContextInput(8, null)))));
    }

    @Test
    void moreContextsThanTheLimitAreRejectedBeforeTheUseCase() throws Exception {
        String contexts = java.util.stream.IntStream
                .rangeClosed(1, uatf.dss.authservice.domain.validator.AcademicContextValidator.MAX_CONTEXTS + 1)
                .mapToObj(i -> "{\"facultyId\":" + i + "}")
                .collect(java.util.stream.Collectors.joining(","));

        mockMvc.perform(put("/admin/users/{id}/academic-contexts", UUID.randomUUID())
                        .with(jwt().authorities(new SimpleGrantedAuthority("iam:users:write")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contexts\":[" + contexts + "]}"))
                .andExpect(status().isBadRequest());

        verify(useCase, org.mockito.Mockito.never()).execute(any());
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
