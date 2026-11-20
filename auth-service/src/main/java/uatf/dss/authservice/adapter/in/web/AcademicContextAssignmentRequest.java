package uatf.dss.authservice.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import uatf.dss.authservice.domain.validator.AcademicContextValidator;

import java.util.List;

public record AcademicContextAssignmentRequest(
        @NotNull @Size(max = AcademicContextValidator.MAX_CONTEXTS) List<@NotNull @Valid ContextDto> contexts
) {
    public record ContextDto(Integer facultyId, String careerId) {}
}
