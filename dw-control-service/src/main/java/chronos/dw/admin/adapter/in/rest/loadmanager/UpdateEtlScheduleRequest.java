package chronos.dw.admin.adapter.in.rest.loadmanager;

import chronos.dw.admin.domain.model.EtlScheduleDefinition;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** Edit a schedule; rowVersion is the version the client loaded (optimistic locking). */
public record UpdateEtlScheduleRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Size(max = 120) String cronExpression,
        @Size(max = 64) String timezone,
        @NotNull @Positive Integer rowVersion) {

    EtlScheduleDefinition toDefinition() {
        return new EtlScheduleDefinition(null, name, cronExpression, timezone, true);
    }
}
