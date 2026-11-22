package chronos.dw.admin.adapter.out.persistence.launch;

import chronos.dw.admin.application.port.out.EtlSchedulePort;
import chronos.dw.admin.domain.exception.EtlScheduleConflictException;
import chronos.dw.admin.domain.exception.EtlScheduleNotFoundException;
import chronos.dw.admin.domain.exception.InvalidEtlScheduleException;
import chronos.dw.admin.domain.model.EtlSchedule;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * Adapter for etl_control.etl_schedule. Reads with SELECT (dw_control_reader) and writes only through the audited
 * functions of migration 0065 (dw_control_api).
 */
@Repository
public class JdbcEtlScheduleRepository implements EtlSchedulePort {

    private static final String COLUMNS =
            """
            schedule_id, process_code, name, cron_expression, timezone, mode, enabled, next_fire_at,
            last_fired_at, last_launch_id, claim_token, claimed_until, created_by, created_at, updated_by,
            updated_at, deleted_at, row_version
            """;

    private static final RowMapper<EtlSchedule> ROW_MAPPER = JdbcEtlScheduleRepository::map;

    private final JdbcTemplate jdbcTemplate;

    public JdbcEtlScheduleRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public EtlSchedule create(
            String processCode,
            String name,
            String cronExpression,
            String timezone,
            Instant nextFireAt,
            boolean enabled,
            String actor) {
        return single(
                null,
                () -> jdbcTemplate.query(
                        "SELECT " + COLUMNS + " FROM etl_control.create_etl_schedule("
                                + "?::varchar, ?::varchar, ?::varchar, ?::varchar, ?::timestamptz, ?::varchar, ?::boolean)",
                        ROW_MAPPER,
                        processCode,
                        name,
                        cronExpression,
                        timezone,
                        timestamp(nextFireAt),
                        actor,
                        enabled));
    }

    @Override
    public EtlSchedule update(
            long scheduleId,
            int expectedRowVersion,
            String name,
            String cronExpression,
            String timezone,
            Instant nextFireAt,
            String actor) {
        return single(
                scheduleId,
                () -> jdbcTemplate.query(
                        "SELECT " + COLUMNS + " FROM etl_control.update_etl_schedule("
                                + "?::bigint, ?::integer, ?::varchar, ?::varchar, ?::varchar, ?::timestamptz, ?::varchar)",
                        ROW_MAPPER,
                        scheduleId,
                        expectedRowVersion,
                        name,
                        cronExpression,
                        timezone,
                        timestamp(nextFireAt),
                        actor));
    }

    @Override
    public EtlSchedule setEnabled(
            long scheduleId, int expectedRowVersion, boolean enabled, Instant nextFireAt, String actor) {
        return single(
                scheduleId,
                () -> jdbcTemplate.query(
                        "SELECT " + COLUMNS + " FROM etl_control.set_etl_schedule_enabled("
                                + "?::bigint, ?::integer, ?::boolean, ?::timestamptz, ?::varchar)",
                        ROW_MAPPER,
                        scheduleId,
                        expectedRowVersion,
                        enabled,
                        timestamp(nextFireAt),
                        actor));
    }

    @Override
    public EtlSchedule delete(long scheduleId, int expectedRowVersion, String actor) {
        return single(
                scheduleId,
                () -> jdbcTemplate.query(
                        "SELECT " + COLUMNS
                                + " FROM etl_control.delete_etl_schedule(?::bigint, ?::integer, ?::varchar)",
                        ROW_MAPPER,
                        scheduleId,
                        expectedRowVersion,
                        actor));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<EtlSchedule> findById(long scheduleId) {
        return jdbcTemplate
                .query(
                        "SELECT " + COLUMNS + " FROM etl_control.etl_schedule"
                                + " WHERE schedule_id = ? AND deleted_at IS NULL",
                        ROW_MAPPER,
                        scheduleId)
                .stream()
                .findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public List<EtlSchedule> findAll() {
        return jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM etl_control.etl_schedule"
                        + " WHERE deleted_at IS NULL ORDER BY lower(name), schedule_id",
                ROW_MAPPER);
    }

    @Override
    public List<EtlSchedule> claimDue(int limit, int leaseSeconds) {
        return jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM etl_control.claim_due_etl_schedules(?::integer, ?::integer)",
                ROW_MAPPER,
                limit,
                leaseSeconds);
    }

    @Override
    public EtlSchedule completeFire(long scheduleId, UUID claimToken, UUID launchId, Instant nextFireAt, String actor) {
        return single(
                scheduleId,
                () -> jdbcTemplate.query(
                        "SELECT " + COLUMNS + " FROM etl_control.complete_etl_schedule_fire("
                                + "?::bigint, ?::uuid, ?::uuid, ?::timestamptz, ?::varchar)",
                        ROW_MAPPER,
                        scheduleId,
                        claimToken,
                        launchId,
                        timestamp(nextFireAt),
                        actor));
    }

    private static EtlSchedule single(Long scheduleId, Supplier<List<EtlSchedule>> command) {
        try {
            return command.get().stream()
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("Schedule command returned no record"));
        } catch (DataAccessException exception) {
            String sqlState = SqlStates.of(exception);
            if ("P0002".equals(sqlState) && scheduleId != null) {
                throw new EtlScheduleNotFoundException(scheduleId);
            }
            if ("22023".equals(sqlState) || "P0002".equals(sqlState)) {
                throw new InvalidEtlScheduleException(SqlStates.message(exception));
            }
            if ("23505".equals(sqlState) || "40001".equals(sqlState) || "55006".equals(sqlState)) {
                throw new EtlScheduleConflictException(SqlStates.message(exception), exception);
            }
            throw exception;
        }
    }

    private static EtlSchedule map(ResultSet resultSet, int rowNumber) throws SQLException {
        return new EtlSchedule(
                resultSet.getLong("schedule_id"),
                resultSet.getString("process_code"),
                resultSet.getString("name"),
                resultSet.getString("cron_expression"),
                resultSet.getString("timezone"),
                resultSet.getString("mode"),
                resultSet.getBoolean("enabled"),
                instant(resultSet, "next_fire_at"),
                instant(resultSet, "last_fired_at"),
                resultSet.getObject("last_launch_id", UUID.class),
                resultSet.getObject("claim_token", UUID.class),
                instant(resultSet, "claimed_until"),
                resultSet.getString("created_by"),
                instant(resultSet, "created_at"),
                resultSet.getString("updated_by"),
                instant(resultSet, "updated_at"),
                instant(resultSet, "deleted_at"),
                resultSet.getInt("row_version"));
    }

    private static Instant instant(ResultSet resultSet, String column) throws SQLException {
        Timestamp timestamp = resultSet.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant();
    }

    private static OffsetDateTime timestamp(Instant instant) {
        return instant == null ? null : OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
