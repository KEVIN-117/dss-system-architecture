package chronos.dw.admin.adapter.out.persistence.closure;

import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import chronos.dw.admin.domain.model.ClosureStatus;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;

/** Maps the existing DW control schema row into the domain model. */
public class AcademicPeriodClosureRowMapper implements RowMapper<AcademicPeriodClosure> {

    @Override
    public AcademicPeriodClosure mapRow(ResultSet resultSet, int rowNumber) throws SQLException {
        return new AcademicPeriodClosure(
                resultSet.getLong("closure_id"),
                resultSet.getInt("gestion"),
                resultSet.getInt("periodo"),
                ClosureStatus.valueOf(resultSet.getString("status")),
                instant(resultSet, "effective_at"),
                resultSet.getString("authorized_by_subject"),
                resultSet.getString("created_by_subject"),
                resultSet.getString("closure_reason"),
                resultSet.getInt("version"),
                uuid(resultSet.getObject("processed_run_id")),
                instant(resultSet, "processed_at"),
                instant(resultSet, "created_at"),
                instant(resultSet, "updated_at"));
    }

    private static java.time.Instant instant(ResultSet resultSet, String column) throws SQLException {
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
