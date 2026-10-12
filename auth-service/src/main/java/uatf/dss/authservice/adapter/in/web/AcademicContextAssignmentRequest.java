package uatf.dss.authservice.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record AcademicContextAssignmentRequest(
        @NotNull List<@NotNull @Valid ContextDto> contexts
) {
    public record ContextDto(Integer facultyId, String careerId) {}
}
