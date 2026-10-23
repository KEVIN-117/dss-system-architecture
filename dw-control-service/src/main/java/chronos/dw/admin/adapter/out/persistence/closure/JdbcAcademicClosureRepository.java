package chronos.dw.admin.adapter.out.persistence.closure;

import chronos.dw.admin.application.model.ClosurePage;
import chronos.dw.admin.application.port.out.LoadAcademicClosuresPort;
import chronos.dw.admin.application.port.out.QueryAcademicClosurePort;
import chronos.dw.admin.domain.model.AcademicClosureSearchCriteria;
import chronos.dw.admin.domain.model.AcademicPeriodClosure;
import chronos.dw.admin.domain.model.AcademicPeriodClosureEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Read-only PostgreSQL adapter for the academic closure calendar. */
@Repository
public class JdbcAcademicClosureRepository implements LoadAcademicClosuresPort, QueryAcademicClosurePort {

    private static final String SELECT_COLUMNS =
            """
            SELECT closure_id, gestion, periodo, status, effective_at, authorized_by_subject,
                   created_by_subject, closure_reason, version, processed_run_id, processed_at,
                   created_at, updated_at
            FROM etl_control.academic_period_closure
            """;

    private final JdbcTemplate jdbcTemplate;
    private final AcademicPeriodClosureRowMapper rowMapper = new AcademicPeriodClosureRowMapper();
    private final AcademicPeriodClosureEventRowMapper eventRowMapper = new AcademicPeriodClosureEventRowMapper();

    public JdbcAcademicClosureRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional(readOnly = true)
    public ClosurePage<AcademicPeriodClosure> load(AcademicClosureSearchCriteria criteria, int page, int size) {
        List<Object> parameters = new ArrayList<>();
        String whereClause = whereClause(criteria, parameters);

        Long totalResult = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM etl_control.academic_period_closure" + whereClause,
                Long.class,
                parameters.toArray());
        long totalElements = totalResult == null ? 0 : totalResult;

        List<Object> pageParameters = new ArrayList<>(parameters);
        pageParameters.add(size);
        pageParameters.add((long) page * size);
        List<AcademicPeriodClosure> items = jdbcTemplate.query(
                SELECT_COLUMNS + whereClause + " ORDER BY gestion DESC, periodo DESC, closure_id DESC LIMIT ? OFFSET ?",
                rowMapper,
                pageParameters.toArray());

        long totalPages = totalElements / size + (totalElements % size == 0 ? 0 : 1);
        return new ClosurePage<>(items, page, size, totalElements, totalPages);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<AcademicPeriodClosure> findById(long closureId) {
        return jdbcTemplate.query(SELECT_COLUMNS + " WHERE closure_id = ?", rowMapper, closureId).stream()
                .findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public ClosurePage<AcademicPeriodClosureEvent> loadEvents(long closureId, int page, int size) {
        Long totalResult = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM etl_control.academic_period_closure_event WHERE closure_id = ?",
                Long.class,
                closureId);
        long totalElements = totalResult == null ? 0 : totalResult;
        List<AcademicPeriodClosureEvent> items = jdbcTemplate.query(
                """
                        SELECT event_id, closure_id, from_status, to_status, actor_subject, reason, run_id, occurred_at
                        FROM etl_control.academic_period_closure_event
                        WHERE closure_id = ?
                        ORDER BY occurred_at DESC, event_id DESC
                        LIMIT ? OFFSET ?
                        """,
                eventRowMapper,
                closureId,
                size,
                (long) page * size);
        long totalPages = totalElements / size + (totalElements % size == 0 ? 0 : 1);
        return new ClosurePage<>(items, page, size, totalElements, totalPages);
    }

    private static String whereClause(AcademicClosureSearchCriteria criteria, List<Object> parameters) {
        StringBuilder where = new StringBuilder(" WHERE TRUE");
        if (criteria.gestion() != null) {
            where.append(" AND gestion = ?");
            parameters.add(criteria.gestion());
        }
        if (criteria.periodo() != null) {
            where.append(" AND periodo = ?");
            parameters.add(criteria.periodo());
        }
        if (criteria.status() != null) {
            where.append(" AND status = ?");
            parameters.add(criteria.status().name());
        }
        return where.toString();
    }
}
