package chronos.dw.admin.adapter.in.rest.closure;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateAcademicClosureRequest(
        @NotNull @Min(2000) @Max(32767) Integer gestion,
        @NotNull @Min(1) @Max(32767) Integer periodo,
        @NotBlank @Size(max = 2000) String reason) {}
