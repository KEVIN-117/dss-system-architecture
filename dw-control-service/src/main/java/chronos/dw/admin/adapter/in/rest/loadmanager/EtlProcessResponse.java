package chronos.dw.admin.adapter.in.rest.loadmanager;

import chronos.dw.admin.domain.model.EtlProcess;
import java.util.List;

/** A process of the Load Manager catalog. */
public record EtlProcessResponse(
        String code,
        String displayName,
        String description,
        String workflowFile,
        List<String> parameterNames,
        boolean schedulable,
        String scheduleMode,
        boolean enabled) {

    static EtlProcessResponse from(EtlProcess process) {
        return new EtlProcessResponse(
                process.code(),
                process.displayName(),
                process.description(),
                process.workflowFile(),
                process.parameterNames().stream().sorted().toList(),
                process.schedulable(),
                process.scheduleMode(),
                process.enabled());
    }
}
