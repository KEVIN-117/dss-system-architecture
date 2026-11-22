package chronos.dw.admin.adapter.out.persistence.launch;

import chronos.dw.admin.application.port.out.EtlProcessCatalogPort;
import chronos.dw.admin.domain.model.EtlProcess;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Read-only adapter for etl_control.etl_process (migration 0062). */
@Repository
public class JdbcEtlProcessCatalogRepository implements EtlProcessCatalogPort {

    private static final String SELECT_COLUMNS =
            """
            SELECT process_code, display_name, description, workflow_file, parameter_names,
                   schedule_mode, enabled
            FROM etl_control.etl_process
            """;

    private static final RowMapper<EtlProcess> ROW_MAPPER = JdbcEtlProcessCatalogRepository::map;

    private final JdbcTemplate jdbcTemplate;

    public JdbcEtlProcessCatalogRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional(readOnly = true)
    public List<EtlProcess> findAll() {
        return jdbcTemplate.query(SELECT_COLUMNS + " ORDER BY process_code", ROW_MAPPER);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<EtlProcess> findByCode(String processCode) {
        return jdbcTemplate.query(SELECT_COLUMNS + " WHERE process_code = ?", ROW_MAPPER, processCode).stream()
                .findFirst();
    }

    private static EtlProcess map(ResultSet resultSet, int rowNumber) throws SQLException {
        return new EtlProcess(
                resultSet.getString("process_code"),
                resultSet.getString("display_name"),
                resultSet.getString("description"),
                resultSet.getString("workflow_file"),
                parameterNames(resultSet.getArray("parameter_names")),
                resultSet.getString("schedule_mode"),
                resultSet.getBoolean("enabled"));
    }

    private static Set<String> parameterNames(Array array) throws SQLException {
        if (array == null) {
            return Set.of();
        }
        try {
            Object[] values = (Object[]) array.getArray();
            return new LinkedHashSet<>(
                    Arrays.stream(values).map(String::valueOf).toList());
        } finally {
            array.free();
        }
    }
}
