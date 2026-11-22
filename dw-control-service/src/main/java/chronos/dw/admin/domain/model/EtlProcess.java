package chronos.dw.admin.domain.model;

import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/** A row of etl_control.etl_process: a project workflow the Load Manager may launch. */
public record EtlProcess(
        String code,
        String displayName,
        String description,
        String workflowFile,
        Set<String> parameterNames,
        String scheduleMode,
        boolean enabled) {

    public static final String VERTICAL_LOAD = "VERTICAL_LOAD";
    public static final String CATALOG_SYNC = "CATALOG_SYNC";
    public static final String PUBLISH_STAGED = "PUBLISH_STAGED";

    private static final Pattern WORKFLOW_FILE = Pattern.compile("^workflows/[a-z0-9_]+\\.hwf$");

    public EtlProcess {
        Objects.requireNonNull(code, "code is required");
        Objects.requireNonNull(displayName, "displayName is required");
        if (workflowFile == null || !WORKFLOW_FILE.matcher(workflowFile).matches()) {
            throw new IllegalArgumentException("Invalid workflow file for process " + code);
        }
        parameterNames = parameterNames == null ? Set.of() : Set.copyOf(parameterNames);
    }

    public boolean schedulable() {
        return scheduleMode != null;
    }
}
