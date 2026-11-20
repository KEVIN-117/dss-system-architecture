package uatf.dss.authservice.adapter.in.web;

import org.junit.jupiter.api.Test;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import uatf.dss.authservice.application.port.in.AdminAuditPage;
import uatf.dss.authservice.application.port.in.ListAdminAuditQuery;
import uatf.dss.authservice.application.port.in.ListAdminAuditUseCase;
import uatf.dss.authservice.domain.exception.validation.ValidationException;
import uatf.dss.authservice.domain.model.audit.AdminAuditEntry;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.audit.AuditOutcome;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;

import java.time.Instant;
import java.util.List;
import java.util.Map;
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

@WebMvcTest(controllers = AdminAuditController.class)
class AdminAuditControllerTest extends BaseWebMvcTest {

    private static final String PATH = "/admin/iam/audit";

    @MockitoBean
    private ListAdminAuditUseCase useCase;

    private static SimpleGrantedAuthority auditRead() {
        return new SimpleGrantedAuthority("iam:audit:read");
    }

    @Test
    void unauthenticatedIsRejected() throws Exception {
        mockMvc.perform(get(PATH)).andExpect(status().isUnauthorized());
    }

    @Test
    void requiresAuditReadPermission() throws Exception {
        mockMvc.perform(get(PATH).with(jwt().authorities(new SimpleGrantedAuthority("ROLE_SUPERADMIN"),
                        new SimpleGrantedAuthority("iam:users:read"))))
                .andExpect(status().isForbidden());
        verify(useCase, never()).execute(any());
    }

    @Test
    void returnsTheFilteredPageNewestFirstWithoutCaching() throws Exception {
        AdminAuditEntry entry = new AdminAuditEntry(UUID.fromString("0f6c1a2e-0000-4000-8000-000000000001"),
                Instant.parse("2026-11-20T10:00:00Z"), new AuditActor("kc-1", "ana.admin", "203.0.113.9"),
                "USER_ACADEMIC_CONTEXTS_REPLACED", AuditTargetType.USER, "u-1", null,
                Map.of("academicContexts", List.of()), AuditOutcome.SUCCESS, null, Instant.parse("2026-11-20T10:00:00Z"));
        ListAdminAuditQuery expected = new ListAdminAuditQuery("ana.admin", "USER_ACADEMIC_CONTEXTS_REPLACED",
                AuditTargetType.USER, "u-1", AuditOutcome.SUCCESS, Instant.parse("2026-11-01T00:00:00Z"),
                Instant.parse("2026-12-01T00:00:00Z"), 1, 10);
        when(useCase.execute(expected)).thenReturn(new AdminAuditPage(List.of(entry), 1, 10, 11, 2));

        mockMvc.perform(get(PATH).with(jwt().authorities(auditRead()))
                        .param("actor", "ana.admin")
                        .param("action", "USER_ACADEMIC_CONTEXTS_REPLACED")
                        .param("targetType", "USER")
                        .param("targetId", "u-1")
                        .param("outcome", "SUCCESS")
                        .param("from", "2026-11-01T00:00:00Z")
                        .param("to", "2026-12-01T00:00:00Z")
                        .param("page", "1")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.totalElements").value(11))
                .andExpect(jsonPath("$.content[0].action").value("USER_ACADEMIC_CONTEXTS_REPLACED"))
                .andExpect(jsonPath("$.content[0].actor.username").value("ana.admin"))
                .andExpect(jsonPath("$.content[0].actor.ipAddress").value("203.0.113.9"))
                .andExpect(jsonPath("$.content[0].outcome").value("SUCCESS"));
        verify(useCase).execute(expected);
    }

    @Test
    void appliesDefaultPagination() throws Exception {
        when(useCase.execute(any())).thenReturn(new AdminAuditPage(List.of(), 0, 20, 0, 0));

        mockMvc.perform(get(PATH).with(jwt().authorities(auditRead()))).andExpect(status().isOk());

        verify(useCase).execute(new ListAdminAuditQuery(null, null, null, null, null, null, null, 0, 20));
    }

    @Test
    void rejectsInvalidParameters() throws Exception {
        mockMvc.perform(get(PATH).with(jwt().authorities(auditRead())).param("size", "500"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(PATH).with(jwt().authorities(auditRead())).param("targetType", "PLANET"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(PATH).with(jwt().authorities(auditRead())).param("from", "ayer"))
                .andExpect(status().isBadRequest());
        verify(useCase, never()).execute(any());
    }

    @Test
    void invalidDateRangeIsABadRequest() throws Exception {
        when(useCase.execute(any())).thenThrow(new ValidationException("El inicio del rango de fechas debe ser anterior al final."));

        mockMvc.perform(get(PATH).with(jwt().authorities(auditRead()))
                        .param("from", "2026-12-01T00:00:00Z").param("to", "2026-11-01T00:00:00Z"))
                .andExpect(status().isBadRequest());
    }
}
