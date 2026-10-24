package chronos.dw.admin.adapter.in.rest.closure;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReopenAcademicPeriodRequest(@NotBlank @Size(max = 2000) String reason) {}
