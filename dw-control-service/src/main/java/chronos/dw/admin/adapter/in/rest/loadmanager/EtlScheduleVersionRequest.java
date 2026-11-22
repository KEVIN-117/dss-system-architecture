package chronos.dw.admin.adapter.in.rest.loadmanager;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** Version the client loaded, for enable and disable (optimistic locking). */
public record EtlScheduleVersionRequest(@NotNull @Positive Integer rowVersion) {}
