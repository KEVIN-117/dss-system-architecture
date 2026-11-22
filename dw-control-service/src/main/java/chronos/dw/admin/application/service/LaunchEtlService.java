package chronos.dw.admin.application.service;

import chronos.dw.admin.application.port.in.LaunchEtlProcessUseCase;
import chronos.dw.admin.application.port.out.EtlLaunchPort;
import chronos.dw.admin.application.port.out.EtlProcessCatalogPort;
import chronos.dw.admin.application.port.out.HopExecutionPort;
import chronos.dw.admin.application.port.out.QueryAcademicClosurePort;
import chronos.dw.admin.application.port.out.QueryEtlExecutionsPort;
import chronos.dw.admin.domain.exception.AcademicClosureNotFoundException;
import chronos.dw.admin.domain.exception.EtlExecutionNotFoundException;
import chronos.dw.admin.domain.exception.EtlProcessNotFoundException;
import chronos.dw.admin.domain.exception.HopRequestRejectedException;
import chronos.dw.admin.domain.exception.HopUnavailableException;
import chronos.dw.admin.domain.exception.InvalidEtlLaunchRequestException;
import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import chronos.dw.admin.domain.model.ClosureStatus;
import chronos.dw.admin.domain.model.EtlExecutionKind;
import chronos.dw.admin.domain.model.EtlExecutionSummary;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import chronos.dw.admin.domain.model.EtlProcess;
import chronos.dw.admin.domain.model.LaunchEtlCommand;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Registers a launch (etl_launch, QUEUED) and submits it to Hop Server. The database call and the HTTP call are not
 * wrapped in one transaction: the request is committed first so a Hop failure is still recorded (SUBMIT_FAILED).
 */
@Service
public class LaunchEtlService implements LaunchEtlProcessUseCase {

    static final String SYSTEM_ACTOR = "dw-control-service";

    private static final Logger LOG = LoggerFactory.getLogger(LaunchEtlService.class);

    private final EtlProcessCatalogPort catalog;
    private final EtlLaunchPort launches;
    private final HopExecutionPort hop;
    private final QueryAcademicClosurePort closures;
    private final QueryEtlExecutionsPort executions;
    private final Supplier<UUID> idGenerator;

    @Autowired
    public LaunchEtlService(
            EtlProcessCatalogPort catalog,
            EtlLaunchPort launches,
            HopExecutionPort hop,
            QueryAcademicClosurePort closures,
            QueryEtlExecutionsPort executions) {
        this(catalog, launches, hop, closures, executions, UUID::randomUUID);
    }

    LaunchEtlService(
            EtlProcessCatalogPort catalog,
            EtlLaunchPort launches,
            HopExecutionPort hop,
            QueryAcademicClosurePort closures,
            QueryEtlExecutionsPort executions,
            Supplier<UUID> idGenerator) {
        this.catalog = catalog;
        this.launches = launches;
        this.hop = hop;
        this.closures = closures;
        this.executions = executions;
        this.idGenerator = idGenerator;
    }

    @Override
    public EtlLaunch launch(LaunchEtlCommand command) {
        EtlProcess process = catalog.findByCode(command.processCode())
                .orElseThrow(() -> new EtlProcessNotFoundException(command.processCode()));
        if (!process.enabled()) {
            throw new InvalidEtlLaunchRequestException("El proceso " + process.code() + " está deshabilitado");
        }

        UUID launchId = idGenerator.get();
        LaunchPlan plan = plan(process, command);
        if (!process.parameterNames().containsAll(plan.parameters().keySet())) {
            throw new IllegalStateException("Launch parameters do not match the catalog of " + process.code());
        }

        EtlLaunch queued = launches.request(
                launchId,
                process.code(),
                command.actor(),
                plan.parameters(),
                plan.closureId(),
                plan.runId(),
                command.scheduleId());
        return submit(queued, process);
    }

    private EtlLaunch submit(EtlLaunch launch, EtlProcess process) {
        UUID hopExecutionId;
        try {
            hopExecutionId = hop.submit(process.workflowFile(), launch.parameters());
        } catch (HopUnavailableException exception) {
            launches.transition(
                    launch.id(),
                    EtlLaunchStatus.SUBMIT_FAILED,
                    SYSTEM_ACTOR,
                    null,
                    "Hop Server no está disponible; la ejecución no se envió",
                    null);
            throw exception;
        } catch (HopRequestRejectedException exception) {
            return launches.transition(
                    launch.id(),
                    EtlLaunchStatus.SUBMIT_FAILED,
                    SYSTEM_ACTOR,
                    null,
                    EtlLogExcerpts.limit(EtlLogExcerpts.sanitize(exception.getMessage())),
                    null);
        }

        try {
            return launches.transition(
                    launch.id(), EtlLaunchStatus.SUBMITTED, SYSTEM_ACTOR, hopExecutionId, null, null);
        } catch (RuntimeException exception) {
            LOG.error(
                    "Launch {} started on Hop Server as {} but could not be marked SUBMITTED",
                    launch.id(),
                    hopExecutionId,
                    exception);
            throw exception;
        }
    }

    private LaunchPlan plan(EtlProcess process, LaunchEtlCommand command) {
        return switch (process.code()) {
            case EtlProcess.VERTICAL_LOAD -> verticalLoad(command);
            case EtlProcess.PUBLISH_STAGED -> publishStaged(command);
            case EtlProcess.CATALOG_SYNC -> new LaunchPlan(Map.of(), null, null);
            default -> {
                if (!process.parameterNames().isEmpty()) {
                    throw new InvalidEtlLaunchRequestException(
                            "El proceso " + process.code() + " no tiene un plan de lanzamiento");
                }
                yield new LaunchPlan(Map.of(), null, null);
            }
        };
    }

    private LaunchPlan verticalLoad(LaunchEtlCommand command) {
        EtlExecutionKind kind = command.executionKind();
        if (kind == EtlExecutionKind.CIERRE_ACADEMICO) {
            if (command.closureId() == null) {
                throw new InvalidEtlLaunchRequestException("Una carga de cierre académico requiere el cierre");
            }
            AcademicPeriodClosure closure = closures.findById(command.closureId())
                    .orElseThrow(() -> new AcademicClosureNotFoundException(command.closureId()));
            if (closure.status() != ClosureStatus.CERRADO) {
                throw new InvalidEtlLaunchRequestException(
                        "Solo se puede cargar un periodo con cierre CERRADO (estado actual: " + closure.status() + ")");
            }
            UUID runId = idGenerator.get();
            Map<String, String> parameters = verticalParameters(runId, closure.gestion(), closure.periodo(), kind);
            return new LaunchPlan(parameters, closure.id(), runId);
        }
        if (kind == EtlExecutionKind.REPROCESO) {
            if (command.retryOfRunId() == null) {
                throw new InvalidEtlLaunchRequestException("Un reproceso requiere la ejecución a reintentar");
            }
            EtlExecutionSummary original = executions
                    .findSummary(command.retryOfRunId())
                    .orElseThrow(() -> new EtlExecutionNotFoundException(command.retryOfRunId()));
            if (original.requestedGestion() == null || original.requestedPeriodo() == null) {
                throw new InvalidEtlLaunchRequestException("La ejecución a reintentar no tiene gestión y periodo");
            }
            UUID runId = idGenerator.get();
            Map<String, String> parameters =
                    verticalParameters(runId, original.requestedGestion(), original.requestedPeriodo(), kind);
            parameters.put("P_RETRY_OF_RUN_ID", original.runId().toString());
            return new LaunchPlan(parameters, original.closureId(), runId);
        }
        throw new InvalidEtlLaunchRequestException(
                "La carga vertical admite CIERRE_ACADEMICO o REPROCESO desde el Load Manager");
    }

    private LaunchPlan publishStaged(LaunchEtlCommand command) {
        if (command.runId() == null) {
            throw new InvalidEtlLaunchRequestException("La publicación requiere la ejecución preparada");
        }
        EtlExecutionSummary execution = executions
                .findSummary(command.runId())
                .orElseThrow(() -> new EtlExecutionNotFoundException(command.runId()));
        return new LaunchPlan(
                Map.of("P_RUN_ID", execution.runId().toString()), execution.closureId(), execution.runId());
    }

    private static Map<String, String> verticalParameters(UUID runId, int gestion, int periodo, EtlExecutionKind kind) {
        Map<String, String> parameters = new LinkedHashMap<>();
        parameters.put("P_RUN_ID", runId.toString());
        parameters.put("P_REQUESTED_GESTION", Integer.toString(gestion));
        parameters.put("P_REQUESTED_PERIODO", Integer.toString(periodo));
        parameters.put("P_EXECUTION_KIND", kind.name());
        return parameters;
    }

    private record LaunchPlan(Map<String, String> parameters, Long closureId, UUID runId) {}
}
