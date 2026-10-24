package chronos.dw.admin.adapter.out.persistence.execution;

import chronos.dw.admin.domain.model.EtlExecutionKind;
import chronos.dw.admin.domain.model.EtlExecutionStatus;
import chronos.dw.admin.domain.model.EtlExecutionSummary;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;

public class EtlExecutionRowMapper implements RowMapper<EtlExecutionSummary> {

    @Override
    public EtlExecutionSummary mapRow(ResultSet resultSet, int rowNumber) throws SQLException {
        return new EtlExecutionSummary(
                uuid(resultSet.getObject("run_id")),
                EtlExecutionKind.valueOf(resultSet.getString("execution_kind")),
                EtlExecutionStatus.valueOf(resultSet.getString("status")),
                nullableLong(resultSet, "closure_id"),
                nullableInteger(resultSet, "requested_gestion"),
                nullableInteger(resultSet, "requested_periodo"),
                resultSet.getString("requested_by"),
                instant(resultSet, "requested_at"),
                instant(resultSet, "started_at"),
                instant(resultSet, "ended_at"));
    }

    private static UUID uuid(Object value) {
        if (value == null || value instanceof UUID) {
            return (UUID) value;
        }
        return UUID.fromString(value.toString());
    }

    private static Long nullableLong(ResultSet resultSet, String column) throws SQLException {
        long value = resultSet.getLong(column);
        return resultSet.wasNull() ? null : value;
    }

    private static Integer nullableInteger(ResultSet resultSet, String column) throws SQLException {
        int value = resultSet.getInt(column);
        return resultSet.wasNull() ? null : value;
    }

    private static java.time.Instant instant(ResultSet resultSet, String column) throws SQLException {
        Timestamp value = resultSet.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}
