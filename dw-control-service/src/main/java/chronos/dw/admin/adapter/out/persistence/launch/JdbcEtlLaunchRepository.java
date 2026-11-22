package chronos.dw.admin.adapter.out.persistence.launch;

import chronos.dw.admin.application.model.ExecutionPage;
import chronos.dw.admin.application.port.out.EtlLaunchPort;
import chronos.dw.admin.application.port.out.QueryEtlLaunchesPort;
import chronos.dw.admin.domain.exception.EtlLaunchConflictException;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchSearchCriteria;
import chronos.dw.admin.domain.model.EtlLaunchStatus;
import chronos.dw.admin.domain.model.EtlLaunchTrigger;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Adapter for etl_control.etl_launch. Reads with SELECT (dw_control_reader) and writes only through the audited
 * functions of migration 0065 (dw_control_api). Records {@code etl.launch.total} and {@code etl.launch.duration} when
 * a launch reaches a final status.
 */
@Repository
public class JdbcEtlLaunchRepository implements EtlLaunchPort, QueryEtlLaunchesPort {

    static final String COLUMNS =
            """
            launch_id, process_code, trigger_kind, schedule_id, closure_id, run_id, parameters::text AS parameters,
            status, hop_execution_id, requested_by, requested_at, submitted_at, started_at, finished_at,
            stop_requested_by, stop_requested_at, result_summary, log_excerpt, row_version
            """;

    private static final TypeReference<Map<String, String>> PARAMETERS_TYPE = new TypeReference<>() {};

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;
    private final RowMapper<EtlLaunch> rowMapper = this::map;
    private final MeterRegistry meterRegistry;

    @Autowired
    public JdbcEtlLaunchRepository(JdbcTemplate jdbcTemplate, JsonMapper jsonMapper, MeterRegistry meterRegistry) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonMapper = jsonMapper;
        this.meterRegistry = meterRegistry;
    }

    /** Without a meter registry (tests, tools). */
    public JdbcEtlLaunchRepository(JdbcTemplate jdbcTemplate, JsonMapper jsonMapper) {
        this(jdbcTemplate, jsonMapper, new SimpleMeterRegistry());
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
        String parametersJson = jsonMapper.writeValueAsString(parameters == null ? Map.of() : parameters);
        return single(() -> jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM etl_control.request_etl_launch("
                        + "?::uuid, ?::varchar, ?::varchar, ?::jsonb, ?::bigint, ?::uuid, ?::bigint)",
                rowMapper,
                launchId,
                processCode,
                requestedBy,
                parametersJson,
                closureId,
                runId,
                scheduleId));
    }

    @Override
    public EtlLaunch transition(
            UUID launchId,
            EtlLaunchStatus target,
            String actor,
            UUID hopExecutionId,
            String resultSummary,
            String logExcerpt) {
        EtlLaunch updated = single(() -> jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM etl_control.transition_etl_launch("
                        + "?::uuid, ?::varchar, ?::varchar, ?::uuid, ?::text, ?::text)",
                rowMapper,
                launchId,
                target.name(),
                actor,
                hopExecutionId,
                resultSummary,
                logExcerpt));
        if (updated.status().isTerminal()) {
            recordFinished(updated);
        }
        return updated;
    }

    @Override
    public EtlLaunch requestStop(UUID launchId, String actor) {
        return single(() -> jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM etl_control.request_etl_launch_stop(?::uuid, ?::varchar)",
                rowMapper,
                launchId,
                actor));
    }

    @Override
    public EtlLaunch recordSkipped(UUID launchId, long scheduleId, String actor, String reason) {
        EtlLaunch skipped = single(() -> jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM etl_control.record_skipped_etl_launch("
                        + "?::uuid, ?::bigint, ?::varchar, ?::text)",
                rowMapper,
                launchId,
                scheduleId,
                actor,
                reason));
        recordFinished(skipped);
        return skipped;
    }

    @Override
    @Transactional(readOnly = true)
    public ExecutionPage<EtlLaunch> find(EtlLaunchSearchCriteria criteria, int page, int size) {
        List<Object> parameters = new ArrayList<>();
        StringBuilder where = new StringBuilder(" WHERE TRUE");
        if (criteria.processCode() != null) {
            where.append(" AND process_code = ?");
            parameters.add(criteria.processCode());
        }
        if (criteria.status() != null) {
            where.append(" AND status = ?");
            parameters.add(criteria.status().name());
        }
        if (criteria.trigger() != null) {
            where.append(" AND trigger_kind = ?");
            parameters.add(criteria.trigger().name());
        }
        if (criteria.scheduleId() != null) {
            where.append(" AND schedule_id = ?");
            parameters.add(criteria.scheduleId());
        }
        Long total = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM etl_control.etl_launch" + where, Long.class, parameters.toArray());
        long totalElements = total == null ? 0 : total;

        List<Object> pageParameters = new ArrayList<>(parameters);
        pageParameters.add(size);
        pageParameters.add((long) page * size);
        List<EtlLaunch> items = jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM etl_control.etl_launch" + where
                        + " ORDER BY requested_at DESC, launch_id DESC LIMIT ? OFFSET ?",
                rowMapper,
                pageParameters.toArray());
        long totalPages = totalElements / size + (totalElements % size == 0 ? 0 : 1);
        return new ExecutionPage<>(items, page, size, totalElements, totalPages);
    }

    private void recordFinished(EtlLaunch launch) {
        meterRegistry
                .counter(
                        "etl.launch.total",
                        "process",
                        launch.processCode(),
                        "trigger",
                        launch.trigger().name(),
                        "result",
                        launch.status().name())
                .increment();
        if (launch.finishedAt() != null && launch.status() != EtlLaunchStatus.SKIPPED) {
            Timer.builder("etl.launch.duration")
                    .description("Time from request to final status of a Load Manager launch")
                    .tags(
                            "process",
                            launch.processCode(),
                            "result",
                            launch.status().name())
                    .register(meterRegistry)
                    .record(Duration.between(launch.requestedAt(), launch.finishedAt()));
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<EtlLaunch> findById(UUID launchId) {
        return jdbcTemplate
                .query("SELECT " + COLUMNS + " FROM etl_control.etl_launch WHERE launch_id = ?", rowMapper, launchId)
                .stream()
                .findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public List<EtlLaunch> findActive(int limit) {
        return jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM etl_control.etl_launch"
                        + " WHERE status IN ('QUEUED', 'SUBMITTED', 'RUNNING')"
                        + " ORDER BY requested_at, launch_id LIMIT ?",
                rowMapper,
                limit);
    }

    private static EtlLaunch single(Supplier<List<EtlLaunch>> command) {
        try {
            return command.get().stream()
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("Load Manager command returned no record"));
        } catch (DataAccessException exception) {
            String sqlState = SqlStates.of(exception);
            if ("23505".equals(sqlState) || "23514".equals(sqlState)) {
                throw new EtlLaunchConflictException(SqlStates.message(exception), exception);
            }
            throw exception;
        }
    }

    private EtlLaunch map(ResultSet resultSet, int rowNumber) throws SQLException {
        return new EtlLaunch(
                resultSet.getObject("launch_id", UUID.class),
                resultSet.getString("process_code"),
                EtlLaunchTrigger.valueOf(resultSet.getString("trigger_kind")),
                nullableLong(resultSet, "schedule_id"),
                nullableLong(resultSet, "closure_id"),
                resultSet.getObject("run_id", UUID.class),
                parameters(resultSet.getString("parameters")),
                EtlLaunchStatus.valueOf(resultSet.getString("status")),
                resultSet.getObject("hop_execution_id", UUID.class),
                resultSet.getString("requested_by"),
                instant(resultSet, "requested_at"),
                instant(resultSet, "submitted_at"),
                instant(resultSet, "started_at"),
                instant(resultSet, "finished_at"),
                resultSet.getString("stop_requested_by"),
                instant(resultSet, "stop_requested_at"),
                resultSet.getString("result_summary"),
                resultSet.getString("log_excerpt"),
                resultSet.getInt("row_version"));
    }

    private Map<String, String> parameters(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        return new TreeMap<>(jsonMapper.readValue(json, PARAMETERS_TYPE));
    }

    private static Long nullableLong(ResultSet resultSet, String column) throws SQLException {
        long value = resultSet.getLong(column);
        return resultSet.wasNull() ? null : value;
    }

    private static Instant instant(ResultSet resultSet, String column) throws SQLException {
        Timestamp timestamp = resultSet.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant();
    }
}
