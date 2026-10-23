package chronos.dw.admin.adapter.out.persistence.closure;

import chronos.dw.admin.domain.model.AcademicPeriodClosureEvent;
import chronos.dw.admin.domain.model.ClosureStatus;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;

public class AcademicPeriodClosureEventRowMapper implements RowMapper<AcademicPeriodClosureEvent> {

    @Override
    public AcademicPeriodClosureEvent mapRow(ResultSet resultSet, int rowNumber) throws SQLException {
        return new AcademicPeriodClosureEvent(
                resultSet.getLong("event_id"),
                resultSet.getLong("closure_id"),
                status(resultSet.getString("from_status")),
                ClosureStatus.valueOf(resultSet.getString("to_status")),
                resultSet.getString("actor_subject"),
                resultSet.getString("reason"),
                uuid(resultSet.getObject("run_id")),
                instant(resultSet, "occurred_at"));
    }

    private static ClosureStatus status(String value) {
        return value == null ? null : ClosureStatus.valueOf(value);
    }

    private static Instant instant(ResultSet resultSet, String column) throws SQLException {
        Timestamp value = resultSet.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static UUID uuid(Object value) {
        if (value == null || value instanceof UUID) {
            return (UUID) value;
        }
        return UUID.fromString(value.toString());
    }
}
