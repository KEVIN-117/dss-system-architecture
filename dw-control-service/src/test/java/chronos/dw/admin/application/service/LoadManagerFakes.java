package chronos.dw.admin.application.service;

import chronos.dw.admin.application.port.out.EtlLaunchPort;
import chronos.dw.admin.application.port.out.EtlProcessCatalogPort;
import chronos.dw.admin.application.port.out.HopExecutionPort;
import chronos.dw.admin.domain.exception.EtlLaunchConflictException;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import chronos.dw.admin.domain.model.EtlLaunchTrigger;
import chronos.dw.admin.domain.model.EtlProcess;
import chronos.dw.admin.domain.model.HopRunStatus;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** In-memory doubles of the Load Manager ports, mirroring the rules of migration 0065. */
final class LoadManagerFakes {

    static final Instant NOW = Instant.parse("2026-11-22T06:00:00Z");

    private LoadManagerFakes() {}

    static EtlProcess vertical() {
        return new EtlProcess(
                EtlProcess.VERTICAL_LOAD,
                "Carga vertical",
                "",
                "workflows/wf_vertical_uatf_datos_smoke.hwf",
                Set.of(
                        "P_RUN_ID",
                        "P_REQUESTED_GESTION",
                        "P_REQUESTED_PERIODO",
                        "P_EXECUTION_KIND",
                        "P_RETRY_OF_RUN_ID"),
                "AUTO_PENDING_CLOSURES",
                true);
    }

    static EtlProcess catalogSync(boolean enabled) {
        return new EtlProcess(
                EtlProcess.CATALOG_SYNC,
                "Catálogo",
                "",
                "workflows/wf_sync_academic_catalog.hwf",
                Set.of(),
                "NO_PARAMETERS",
                enabled);
    }

    static EtlProcess publishStaged() {
        return new EtlProcess(
                EtlProcess.PUBLISH_STAGED,
                "Publicación",
                "",
                "workflows/wf_hop_publish_staged_run.hwf",
                Set.of("P_RUN_ID"),
                null,
                true);
    }

    static final class Catalog implements EtlProcessCatalogPort {

        private final Map<String, EtlProcess> processes = new LinkedHashMap<>();

        Catalog(EtlProcess... processes) {
            for (EtlProcess process : processes) {
                this.processes.put(process.code(), process);
            }
        }

        @Override
        public List<EtlProcess> findAll() {
            return List.copyOf(processes.values());
        }

        @Override
        public Optional<EtlProcess> findByCode(String processCode) {
            return Optional.ofNullable(processes.get(processCode));
        }
    }

    static final class Launches implements EtlLaunchPort {

        final Map<UUID, EtlLaunch> rows = new LinkedHashMap<>();
        final List<String> transitions = new ArrayList<>();
        private final Clock clock;

        Launches(Clock clock) {
            this.clock = clock;
        }

        @Override
        public EtlLaunch request(
                UUID launchId,
                String processCode,
                String requestedBy,
                Map<String, String> parameters,
                Long closureId,
                UUID runId,
                Long scheduleId) {
            boolean active = rows.values().stream()
                    .anyMatch(row -> row.processCode().equals(processCode)
                            && row.status().isActive());
            if (active) {
                throw new EtlLaunchConflictException("Ya existe una ejecución activa del proceso " + processCode);
            }
            EtlLaunch launch = new EtlLaunch(
                    launchId,
                    processCode,
                    scheduleId == null ? EtlLaunchTrigger.MANUAL : EtlLaunchTrigger.SCHEDULED,
                    scheduleId,
                    closureId,
                    runId,
                    parameters,
                    EtlLaunchStatus.QUEUED,
                    null,
                    requestedBy,
                    clock.instant(),
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    1);
            rows.put(launchId, launch);
            return launch;
        }

        EtlLaunch put(EtlLaunch launch) {
            rows.put(launch.id(), launch);
            return launch;
        }

        @Override
        public EtlLaunch transition(
                UUID launchId,
                EtlLaunchStatus target,
                String actor,
                UUID hopExecutionId,
                String resultSummary,
                String logExcerpt) {
            EtlLaunch current = rows.get(launchId);
            boolean refresh = current.status() == target && current.status().isActive();
            if (!refresh && !allowed(current.status(), target)) {
                throw new EtlLaunchConflictException(current.status() + " -> " + target);
            }
            Instant now = clock.instant();
            EtlLaunch updated = new EtlLaunch(
                    current.id(),
                    current.processCode(),
                    current.trigger(),
                    current.scheduleId(),
                    current.closureId(),
                    current.runId(),
                    current.parameters(),
                    target,
                    hopExecutionId != null ? hopExecutionId : current.hopExecutionId(),
                    current.requestedBy(),
                    current.requestedAt(),
                    target == EtlLaunchStatus.SUBMITTED ? now : current.submittedAt(),
                    target == EtlLaunchStatus.RUNNING && current.startedAt() == null ? now : current.startedAt(),
                    target.isTerminal() ? now : null,
                    current.stopRequestedBy(),
                    current.stopRequestedAt(),
                    resultSummary != null ? resultSummary : current.resultSummary(),
                    logExcerpt != null ? logExcerpt : current.logExcerpt(),
                    refresh ? current.rowVersion() : current.rowVersion() + 1);
            rows.put(launchId, updated);
            if (!refresh) {
                transitions.add(current.status() + "->" + target);
            }
            return updated;
        }

        private static boolean allowed(EtlLaunchStatus from, EtlLaunchStatus to) {
            return switch (from) {
                case QUEUED -> Set.of(
                                EtlLaunchStatus.SUBMITTED,
                                EtlLaunchStatus.SUBMIT_FAILED,
                                EtlLaunchStatus.SKIPPED,
                                EtlLaunchStatus.STOPPED)
                        .contains(to);
                case SUBMITTED -> Set.of(
                                EtlLaunchStatus.RUNNING,
                                EtlLaunchStatus.SUCCEEDED,
                                EtlLaunchStatus.FAILED,
                                EtlLaunchStatus.STOPPED)
                        .contains(to);
                case RUNNING -> Set.of(EtlLaunchStatus.SUCCEEDED, EtlLaunchStatus.FAILED, EtlLaunchStatus.STOPPED)
                        .contains(to);
                default -> false;
            };
        }

        @Override
        public EtlLaunch requestStop(UUID launchId, String actor) {
            EtlLaunch current = rows.get(launchId);
            if (!current.status().isActive()) {
                throw new EtlLaunchConflictException("not active");
            }
            if (current.stopRequested()) {
                return current;
            }
            EtlLaunch updated = new EtlLaunch(
                    current.id(),
                    current.processCode(),
                    current.trigger(),
                    current.scheduleId(),
                    current.closureId(),
                    current.runId(),
                    current.parameters(),
                    current.status(),
                    current.hopExecutionId(),
                    current.requestedBy(),
                    current.requestedAt(),
                    current.submittedAt(),
                    current.startedAt(),
                    current.finishedAt(),
                    actor,
                    clock.instant(),
                    current.resultSummary(),
                    current.logExcerpt(),
                    current.rowVersion() + 1);
            rows.put(launchId, updated);
            return updated;
        }

        @Override
        public Optional<EtlLaunch> findById(UUID launchId) {
            return Optional.ofNullable(rows.get(launchId));
        }

        @Override
        public List<EtlLaunch> findActive(int limit) {
            return rows.values().stream()
                    .filter(row -> row.status().isActive())
                    .sorted(Comparator.comparing(EtlLaunch::requestedAt))
                    .limit(limit)
                    .toList();
        }
    }

    static final class Hop implements HopExecutionPort {

        final Map<UUID, HopRunStatus> statuses = new LinkedHashMap<>();
        final List<String> calls = new ArrayList<>();
        RuntimeException submitFailure;
        RuntimeException statusFailure;
        UUID nextExecutionId = UUID.fromString("00000000-0000-4000-8000-0000000000a1");
        String lastWorkflowFile;
        Map<String, String> lastParameters;

        @Override
        public String serverStatus() {
            return "Online";
        }

        @Override
        public UUID submit(String workflowFile, Map<String, String> parameters) {
            calls.add("submit");
            if (submitFailure != null) {
                throw submitFailure;
            }
            lastWorkflowFile = workflowFile;
            lastParameters = Map.copyOf(parameters);
            return nextExecutionId;
        }

        @Override
        public HopRunStatus status(UUID hopExecutionId) {
            calls.add("status:" + hopExecutionId);
            if (statusFailure != null) {
                throw statusFailure;
            }
            return statuses.getOrDefault(hopExecutionId, HopRunStatus.notFound());
        }

        @Override
        public void stop(UUID hopExecutionId) {
            calls.add("stop:" + hopExecutionId);
        }

        @Override
        public void remove(UUID hopExecutionId) {
            calls.add("remove:" + hopExecutionId);
        }
    }
}
