package chronos.dw.admin.adapter.out.persistence.execution;

import chronos.dw.admin.application.model.ExecutionPage;
import chronos.dw.admin.application.port.out.QueryEtlExecutionsPort;
import chronos.dw.admin.domain.model.EtlExecutionError;
import chronos.dw.admin.domain.model.EtlExecutionMetric;
import chronos.dw.admin.domain.model.EtlExecutionSearchCriteria;
import chronos.dw.admin.domain.model.EtlExecutionStep;
import chronos.dw.admin.domain.model.EtlExecutionSummary;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class JdbcEtlExecutionRepository implements QueryEtlExecutionsPort {

    private static final String SELECT_SUMMARY_COLUMNS =
            """
            SELECT run_id, execution_kind, status, closure_id, requested_gestion, requested_periodo,
                   requested_by, requested_at, started_at, ended_at
            FROM etl_control.etl_execution
            """;

    private final JdbcTemplate jdbcTemplate;
    private final EtlExecutionRowMapper executionRowMapper = new EtlExecutionRowMapper();

    public JdbcEtlExecutionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional(readOnly = true)
    public ExecutionPage<EtlExecutionSummary> find(EtlExecutionSearchCriteria criteria, int page, int size) {
        List<Object> parameters = new ArrayList<>();
        String whereClause = whereClause(criteria, parameters);
        Long totalResult = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM etl_control.etl_execution" + whereClause, Long.class, parameters.toArray());
        long totalElements = totalResult == null ? 0 : totalResult;

        List<Object> pageParameters = new ArrayList<>(parameters);
        pageParameters.add(size);
        pageParameters.add((long) page * size);
        List<EtlExecutionSummary> items = jdbcTemplate.query(
                SELECT_SUMMARY_COLUMNS + whereClause + " ORDER BY requested_at DESC, run_id DESC LIMIT ? OFFSET ?",
                executionRowMapper,
                pageParameters.toArray());
        long totalPages = totalElements / size + (totalElements % size == 0 ? 0 : 1);
        return new ExecutionPage<>(items, page, size, totalElements, totalPages);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<EtlExecutionSummary> findSummary(UUID runId) {
        return jdbcTemplate.query(SELECT_SUMMARY_COLUMNS + " WHERE run_id = ?", executionRowMapper, runId).stream()
                .findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public List<EtlExecutionStep> findSteps(UUID runId) {
        return jdbcTemplate.query(
                """
                SELECT step_code, phase, status, step_order, started_at, ended_at
                FROM etl_control.etl_execution_step
                WHERE run_id = ?
                ORDER BY step_order, step_id
                """,
                (resultSet, rowNumber) -> new EtlExecutionStep(
                        resultSet.getString("step_code"),
                        resultSet.getString("phase"),
                        resultSet.getString("status"),
                        resultSet.getInt("step_order"),
                        instant(resultSet, "started_at"),
                        instant(resultSet, "ended_at")),
                runId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EtlExecutionMetric> findMetrics(UUID runId) {
        return jdbcTemplate.query(
                """
                SELECT metric_name, metric_value, metric_unit, measured_at
                FROM etl_control.etl_execution_metric
                WHERE run_id = ?
                ORDER BY measured_at DESC, metric_id DESC
                """,
                (resultSet, rowNumber) -> new EtlExecutionMetric(
                        resultSet.getString("metric_name"),
                        resultSet.getBigDecimal("metric_value"),
                        resultSet.getString("metric_unit"),
                        instant(resultSet, "measured_at")),
                runId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EtlExecutionError> findSanitizedErrorMetadata(UUID runId) {
        // Deliberately omit cause, message, and details: they may contain SQL, credentials, or personal data.
        return jdbcTemplate.query(
                """
                SELECT error.severity, error.error_code, step.step_code, error.occurred_at
                FROM etl_control.etl_execution_error AS error
                LEFT JOIN etl_control.etl_execution_step AS step ON step.step_id = error.step_id
                WHERE error.run_id = ?
                ORDER BY error.occurred_at DESC, error.error_id DESC
                """,
                (resultSet, rowNumber) -> new EtlExecutionError(
                        resultSet.getString("severity"),
                        resultSet.getString("error_code"),
                        resultSet.getString("step_code"),
                        instant(resultSet, "occurred_at")),
                runId);
    }

    private static String whereClause(EtlExecutionSearchCriteria criteria, List<Object> parameters) {
        StringBuilder where = new StringBuilder(" WHERE TRUE");
        if (criteria.status() != null) {
            where.append(" AND status = ?");
            parameters.add(criteria.status().name());
        }
        if (criteria.executionKind() != null) {
            where.append(" AND execution_kind = ?");
            parameters.add(criteria.executionKind().name());
        }
        if (criteria.gestion() != null) {
            where.append(" AND requested_gestion = ?");
            parameters.add(criteria.gestion());
        }
        if (criteria.periodo() != null) {
            where.append(" AND requested_periodo = ?");
            parameters.add(criteria.periodo());
        }
        if (criteria.closureId() != null) {
            where.append(" AND closure_id = ?");
            parameters.add(criteria.closureId());
        }
        return where.toString();
    }

    private static java.time.Instant instant(ResultSet resultSet, String column) throws SQLException {
        Timestamp value = resultSet.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}
