package chronos.dw.admin.adapter.in.rest.loadmanager;

import chronos.dw.admin.domain.model.EtlScheduleDefinition;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * New schedule. cronExpression uses the six Spring fields (second minute hour day month weekday); timezone defaults
 * to the DSA zone; enabled defaults to true.
 */
public record CreateEtlScheduleRequest(
        @NotBlank @Pattern(regexp = "^[A-Z][A-Z0-9_]{1,31}$") String processCode,
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Size(max = 120) String cronExpression,
        @Size(max = 64) String timezone,
        Boolean enabled) {

    EtlScheduleDefinition toDefinition() {
        return new EtlScheduleDefinition(processCode, name, cronExpression, timezone, enabled == null || enabled);
    }
}
