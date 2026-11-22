package chronos.dw.admin.adapter.in.rest.loadmanager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import chronos.dw.admin.adapter.in.rest.error.ApiExceptionHandler;
import chronos.dw.admin.application.model.ExecutionPage;
import chronos.dw.admin.application.port.in.LaunchEtlProcessUseCase;
import chronos.dw.admin.application.port.in.ManageEtlSchedulesUseCase;
import chronos.dw.admin.application.port.in.QueryLoadManagerUseCase;
import chronos.dw.admin.application.port.in.StopEtlLaunchUseCase;
import chronos.dw.admin.application.service.OperatingWindowPolicy;
import chronos.dw.admin.configuration.EtlProperties;
import chronos.dw.admin.domain.exception.EtlLaunchConflictException;
import chronos.dw.admin.domain.exception.HopUnavailableException;
import chronos.dw.admin.domain.exception.InvalidEtlScheduleException;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchSearchCriteria;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import chronos.dw.admin.domain.model.EtlLaunchTrigger;
import chronos.dw.admin.domain.model.EtlProcess;
import chronos.dw.admin.domain.model.EtlSchedule;
import chronos.dw.admin.domain.model.EtlScheduleDefinition;
import chronos.dw.admin.domain.model.LaunchEtlCommand;
import chronos.dw.admin.domain.model.LoadManagerHealth;
import chronos.dw.admin.domain.model.ScheduleOccurrence;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** HTTP contract of the Load Manager controllers (status codes, Location, problem bodies), without security. */
class LoadManagerControllerTest {

    private static final Instant NOW = Instant.parse("2026-11-23T06:00:00Z");
    private static final UUID LAUNCH_ID = UUID.fromString("66666666-6666-4666-8666-666666666666");

    private final List<LaunchEtlCommand> launched = new ArrayList<>();
    private final List<String> stopped = new ArrayList<>();
    private RuntimeException launchFailure;
    private RuntimeException scheduleFailure;
    private EtlLaunch current = launch(EtlLaunchStatus.RUNNING, "línea 1\nlínea 2");
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        OperatingWindowPolicy policy = new OperatingWindowPolicy(new EtlProperties(null, null, null));
        LaunchEtlProcessUseCase launcher = command -> {
            launched.add(command);
            if (launchFailure != null) {
                throw launchFailure;
            }
            return launch(EtlLaunchStatus.SUBMITTED, null);
        };
        StopEtlLaunchUseCase stopper = (launchId, actor) -> {
            stopped.add(launchId + ":" + actor);
            return current;
        };
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new LoadManagerController(new Queries(), launcher, stopper),
                        new EtlScheduleController(new Schedules(), policy, clock))
                .setControllerAdvice(new ApiExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();
        Jwt jwt = Jwt.withTokenValue("t")
                .header("alg", "none")
                .subject("operator-1")
                .issuedAt(NOW)
                .expiresAt(NOW.plusSeconds(300))
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
    }

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void launchAnswersCreatedWithLocationAndTheTokenSubjectAsActor() throws Exception {
        mockMvc.perform(post("/api/v1/etl/launches")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"processCode\":\"VERTICAL_LOAD\",\"executionKind\":\"CIERRE_ACADEMICO\","
                                + "\"closureId\":7}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/v1/etl/launches/" + LAUNCH_ID))
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.active").value(true));

        assertThat(launched).hasSize(1);
        assertThat(launched.get(0).actor()).isEqualTo("operator-1");
        assertThat(launched.get(0).closureId()).isEqualTo(7L);
        assertThat(launched.get(0).scheduleId()).isNull();
    }

    @Test
    void launchConflictsAndHopOutagesUseProblemResponses() throws Exception {
        launchFailure = new EtlLaunchConflictException("Ya existe una ejecución activa");
        mockMvc.perform(post("/api/v1/etl/launches")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"processCode\":\"CATALOG_SYNC\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        launchFailure = new HopUnavailableException("down");
        mockMvc.perform(post("/api/v1/etl/launches")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"processCode\":\"CATALOG_SYNC\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("HOP_UNAVAILABLE"));

        mockMvc.perform(post("/api/v1/etl/launches")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"processCode\":\"bad code\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void stopIsAcceptedAndStatusShowsActiveLaunches() throws Exception {
        mockMvc.perform(post("/api/v1/etl/launches/" + LAUNCH_ID + "/stop"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.id").value(LAUNCH_ID.toString()));
        assertThat(stopped).containsExactly(LAUNCH_ID + ":operator-1");

        mockMvc.perform(get("/api/v1/etl/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running").value(true))
                .andExpect(jsonPath("$.active[0].processCode").value("CATALOG_SYNC"));
    }

    @Test
    void logsAreServedSeparatelyFromTheLaunch() throws Exception {
        mockMvc.perform(get("/api/v1/etl/launches/" + LAUNCH_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logExcerpt").doesNotExist());
        mockMvc.perform(get("/api/v1/etl/launches/" + LAUNCH_ID + "/logs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.log").value("línea 1\nlínea 2"));
    }

    @Test
    void catalogAndHealthAreExposed() throws Exception {
        mockMvc.perform(get("/api/v1/etl/processes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value("CATALOG_SYNC"))
                .andExpect(jsonPath("$[0].schedulable").value(true));
        mockMvc.perform(get("/api/v1/etl/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hopOnline").value(true))
                .andExpect(jsonPath("$.schedulerEnabled").value(true));
    }

    @Test
    void scheduleValidationErrorsReachTheClient() throws Exception {
        scheduleFailure = new InvalidEtlScheduleException("La ejecución cae dentro del horario operativo de la DSA");

        mockMvc.perform(post("/api/v1/etl/schedules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"processCode\":\"VERTICAL_LOAD\",\"name\":\"Mañana\","
                                + "\"cronExpression\":\"0 0 10 * * *\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("La ejecución cae dentro del horario operativo de la DSA"));
    }

    @Test
    void scheduleLifecycleEndpoints() throws Exception {
        mockMvc.perform(post("/api/v1/etl/schedules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"processCode\":\"CATALOG_SYNC\",\"name\":\"Catálogo\","
                                + "\"cronExpression\":\"0 0 2 * * *\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/v1/etl/schedules/3"))
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.firing").value(false));

        mockMvc.perform(post("/api/v1/etl/schedules/3/disable")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/etl/schedules/3/disable")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rowVersion\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false));
        mockMvc.perform(delete("/api/v1/etl/schedules/3").param("rowVersion", "2"))
                .andExpect(status().isNoContent());
    }

    @Test
    void previewReportsOccurrencesAndWhetherTheScheduleWouldBeAccepted() throws Exception {
        mockMvc.perform(get("/api/v1/etl/schedules/preview").param("cronExpression", "0 0 9 * * *"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timezone").value("America/La_Paz"))
                .andExpect(jsonPath("$.valid").value(false))
                .andExpect(jsonPath("$.validationMessage").value("dentro del horario"))
                .andExpect(jsonPath("$.occurrences[0].insideOperatingWindow").value(true));
    }

    private EtlLaunch launch(EtlLaunchStatus status, String log) {
        return new EtlLaunch(
                LAUNCH_ID,
                "CATALOG_SYNC",
                EtlLaunchTrigger.MANUAL,
                null,
                null,
                null,
                Map.of(),
                status,
                UUID.randomUUID(),
                "operator-1",
                NOW,
                NOW,
                NOW,
                null,
                null,
                null,
                null,
                log,
                2);
    }

    private final class Queries implements QueryLoadManagerUseCase {

        @Override
        public List<EtlProcess> processes() {
            return List.of(new EtlProcess(
                    "CATALOG_SYNC",
                    "Catálogo",
                    "",
                    "workflows/wf_sync_academic_catalog.hwf",
                    Set.of(),
                    "NO_PARAMETERS",
                    true));
        }

        @Override
        public ExecutionPage<EtlLaunch> launches(EtlLaunchSearchCriteria criteria, int page, int size) {
            return new ExecutionPage<>(List.of(current), page, size, 1, 1);
        }

        @Override
        public EtlLaunch launch(UUID launchId) {
            return current;
        }

        @Override
        public List<EtlLaunch> activeLaunches() {
            return List.of(current);
        }

        @Override
        public LoadManagerHealth health() {
            return new LoadManagerHealth(true, "Online", true, true, "lunes a viernes", NOW);
        }
    }

    private final class Schedules implements ManageEtlSchedulesUseCase {

        @Override
        public List<EtlSchedule> list() {
            return List.of(schedule(true, 1));
        }

        @Override
        public EtlSchedule get(long scheduleId) {
            return schedule(true, 1);
        }

        @Override
        public EtlSchedule create(EtlScheduleDefinition definition, String actor) {
            if (scheduleFailure != null) {
                throw scheduleFailure;
            }
            return schedule(definition.enabled(), 1);
        }

        @Override
        public EtlSchedule update(
                long scheduleId, int expectedRowVersion, EtlScheduleDefinition definition, String actor) {
            return schedule(true, expectedRowVersion + 1);
        }

        @Override
        public EtlSchedule setEnabled(long scheduleId, int expectedRowVersion, boolean enabled, String actor) {
            return schedule(enabled, expectedRowVersion + 1);
        }

        @Override
        public EtlSchedule delete(long scheduleId, int expectedRowVersion, String actor) {
            return schedule(false, expectedRowVersion + 1);
        }

        @Override
        public List<ScheduleOccurrence> preview(String cronExpression, String timezone, int count) {
            return List.of(new ScheduleOccurrence(NOW.plusSeconds(3 * 3600), true));
        }

        @Override
        public Optional<String> validationError(String cronExpression, String timezone) {
            return Optional.of("dentro del horario");
        }

        private EtlSchedule schedule(boolean enabled, int rowVersion) {
            return new EtlSchedule(
                    3L,
                    "CATALOG_SYNC",
                    "Catálogo",
                    "0 0 2 * * *",
                    "America/La_Paz",
                    EtlSchedule.MODE_NO_PARAMETERS,
                    enabled,
                    enabled ? NOW.plusSeconds(86_400) : null,
                    null,
                    null,
                    null,
                    null,
                    "operator-1",
                    NOW,
                    "operator-1",
                    NOW,
                    null,
                    rowVersion);
        }
    }
}
