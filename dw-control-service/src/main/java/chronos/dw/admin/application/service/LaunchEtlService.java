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
import chronos.dw.admin.domain.model.EtlExecutionSearchCriteria;
import chronos.dw.admin.domain.model.EtlExecutionStatus;
import chronos.dw.admin.domain.model.EtlExecutionSummary;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import chronos.dw.admin.domain.model.EtlProcess;
import chronos.dw.admin.domain.model.LaunchEtlCommand;
import java.time.Clock;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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

    /** Attempts of one closure checked before a load; a closure has a handful, far below this bound. */
    private static final int CLOSURE_HISTORY_SIZE = 100;

    private static final Logger LOG = LoggerFactory.getLogger(LaunchEtlService.class);

    private final EtlProcessCatalogPort catalog;
    private final EtlLaunchPort launches;
    private final HopExecutionPort hop;
    private final QueryAcademicClosurePort closures;
    private final QueryEtlExecutionsPort executions;
    private final Supplier<UUID> idGenerator;
    private final Clock clock;

    /** Effective dates in the DSA's zone, as the operator entered them. */
    private static final DateTimeFormatter EFFECTIVE_FORMAT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm '(America/La_Paz)'").withZone(ZoneId.of("America/La_Paz"));

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
        this(catalog, launches, hop, closures, executions, idGenerator, Clock.systemUTC());
    }

    LaunchEtlService(
            EtlProcessCatalogPort catalog,
            EtlLaunchPort launches,
            HopExecutionPort hop,
            QueryAcademicClosurePort closures,
            QueryEtlExecutionsPort executions,
            Supplier<UUID> idGenerator,
            Clock clock) {
        this.catalog = catalog;
        this.launches = launches;
        this.hop = hop;
        this.closures = closures;
        this.executions = executions;
        this.idGenerator = idGenerator;
        this.clock = clock;
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
            EtlLaunch failed = launches.transition(
                    launch.id(),
                    EtlLaunchStatus.SUBMIT_FAILED,
                    SYSTEM_ACTOR,
                    null,
                    "Hop Server no está disponible; la ejecución no se envió",
                    null);
            if (launch.scheduleId() != null) {
                // The scheduler records the failed fire with this launch instead of an HTTP error.
                return failed;
            }
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
            requireEffective(closure);
            UUID runId = idGenerator.get();
            Optional<EtlExecutionSummary> previousLoad = previousLoadOf(closure);
            if (previousLoad.isPresent()) {
                // The closure was reopened and closed again after a successful load: create_hop_etl_execution only
                // accepts it as a REPROCESO of an earlier attempt, so the operator (and the AUTO schedule) can keep
                // asking for "load this closure" without choosing the parent run by hand.
                Map<String, String> parameters =
                        verticalParameters(runId, closure.gestion(), closure.periodo(), EtlExecutionKind.REPROCESO);
                parameters.put("P_RETRY_OF_RUN_ID", previousLoad.get().runId().toString());
                return new LaunchPlan(parameters, closure.id(), runId);
            }
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
            if (!original.status().isTerminal()) {
                throw new InvalidEtlLaunchRequestException(
                        "Solo se puede reprocesar una ejecución terminada (estado actual: " + original.status() + ")");
            }
            if (original.closureId() != null) {
                requireReprocessableClosure(original.closureId());
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

    /**
     * Mirrors the gate of create_hop_etl_execution (0010): a closure reprocess needs the closure CERRADO again and not
     * processed. Checking it here answers 422 with the reason instead of launching a Hop run that fails at preflight.
     */
    private void requireReprocessableClosure(long closureId) {
        AcademicPeriodClosure closure =
                closures.findById(closureId).orElseThrow(() -> new AcademicClosureNotFoundException(closureId));
        if (closure.status() != ClosureStatus.CERRADO || closure.processedRunId() != null) {
            throw new InvalidEtlLaunchRequestException("El cierre de gestión " + closure.gestion() + " periodo "
                    + closure.periodo() + " está " + closure.status()
                    + "; para reprocesarlo, reábrelo y vuelve a cerrarlo desde Cierres académicos");
        }
        requireEffective(closure);
    }

    /**
     * Latest finished attempt of a closure that was already loaded successfully, or empty when the closure was never
     * loaded (first load, or only failed attempts). An attempt still running blocks the launch, as in the 0010 gate.
     */
    private Optional<EtlExecutionSummary> previousLoadOf(AcademicPeriodClosure closure) {
        List<EtlExecutionSummary> attempts = executions
                .find(new EtlExecutionSearchCriteria(null, null, null, null, closure.id()), 0, CLOSURE_HISTORY_SIZE)
                .items();
        if (attempts.stream().anyMatch(attempt -> !attempt.status().isTerminal())) {
            throw new InvalidEtlLaunchRequestException("El cierre de gestión " + closure.gestion() + " periodo "
                    + closure.periodo() + " ya tiene una carga en curso; espera a que termine");
        }
        if (attempts.stream().noneMatch(attempt -> attempt.status() == EtlExecutionStatus.EXITOSA)) {
            return Optional.empty();
        }
        // Newest first (requested_at DESC): the parent of the reprocess is the latest finished attempt.
        return attempts.stream().findFirst();
    }

    /** Hop's preflight (0010) refuses a closure whose effective date is still in the future. */
    private void requireEffective(AcademicPeriodClosure closure) {
        if (closure.effectiveAt() != null && closure.effectiveAt().isAfter(clock.instant())) {
            throw new InvalidEtlLaunchRequestException("El cierre de gestión " + closure.gestion() + " periodo "
                    + closure.periodo() + " recién será efectivo el " + EFFECTIVE_FORMAT.format(closure.effectiveAt())
                    + "; no se puede cargar antes de esa fecha. Si la fecha es un error, reábrelo y vuelve a cerrarlo"
                    + " con la fecha correcta");
        }
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
