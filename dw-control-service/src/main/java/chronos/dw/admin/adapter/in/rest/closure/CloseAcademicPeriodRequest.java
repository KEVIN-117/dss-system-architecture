package chronos.dw.admin.adapter.in.rest.closure;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public record CloseAcademicPeriodRequest(@NotNull Instant effectiveAt, @NotBlank @Size(max = 2000) String reason) {}
