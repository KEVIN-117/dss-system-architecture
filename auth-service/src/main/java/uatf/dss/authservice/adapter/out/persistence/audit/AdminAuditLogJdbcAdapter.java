package uatf.dss.authservice.adapter.out.persistence.audit;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;
import uatf.dss.authservice.application.port.in.AdminAuditPage;
import uatf.dss.authservice.application.port.in.ListAdminAuditQuery;
import uatf.dss.authservice.application.port.out.AdminAuditLogRepository;
import uatf.dss.authservice.domain.model.audit.AdminAuditEntry;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.audit.AuditOutcome;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** {@link AdminAuditLogRepository} on the {@code admin_audit_log} table (V7), with JSON snapshots in {@code jsonb}. */
@Repository
public class AdminAuditLogJdbcAdapter implements AdminAuditLogRepository {

    private static final TypeReference<Map<String, Object>> JSON_OBJECT = new TypeReference<>() {
    };
    private static final String COLUMNS = "id, occurred_at, actor_keycloak_id, actor_username, action, target_type, "
            + "target_id, before_state, after_state, ip_address, outcome, failure_reason, completed_at";

    private final JdbcTemplate jdbcTemplate;
    private final JsonMapper jsonMapper;

    public AdminAuditLogJdbcAdapter(JdbcTemplate jdbcTemplate, JsonMapper jsonMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonMapper = jsonMapper;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public void append(AdminAuditEntry entry) {
        insert(entry);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void appendIndependently(AdminAuditEntry entry) {
        insert(entry);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completeIndependently(AdminAuditEntry entry) {
        int updated = jdbcTemplate.update("""
                        UPDATE admin_audit_log
                           SET outcome = ?, after_state = CAST(? AS jsonb), failure_reason = ?, completed_at = ?
                         WHERE id = ?""",
                entry.outcome().name(), json(entry.after()), entry.failureReason(), timestamp(entry.completedAt()),
                entry.id());
        if (updated == 0) {
            insert(entry);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public AdminAuditPage search(ListAdminAuditQuery query) {
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        List<Object> params = new ArrayList<>();
        if (hasText(query.actor())) {
            where.append(" AND (actor_keycloak_id = ? OR actor_username = ?)");
            params.add(query.actor().trim());
            params.add(query.actor().trim());
        }
        if (hasText(query.action())) {
            where.append(" AND action = ?");
            params.add(query.action().trim());
        }
        if (query.targetType() != null) {
            where.append(" AND target_type = ?");
            params.add(query.targetType().name());
        }
        if (hasText(query.targetId())) {
            where.append(" AND target_id = ?");
            params.add(query.targetId().trim());
        }
        if (query.outcome() != null) {
            where.append(" AND outcome = ?");
            params.add(query.outcome().name());
        }
        if (query.from() != null) {
            where.append(" AND occurred_at >= ?");
            params.add(timestamp(query.from()));
        }
        if (query.to() != null) {
            where.append(" AND occurred_at < ?");
            params.add(timestamp(query.to()));
        }

        Long total = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM admin_audit_log" + where, Long.class,
                params.toArray());
        long totalElements = total == null ? 0 : total;

        List<Object> pageParams = new ArrayList<>(params);
        pageParams.add(query.size());
        pageParams.add((long) query.page() * query.size());
        List<AdminAuditEntry> content = jdbcTemplate.query(
                "SELECT " + COLUMNS + " FROM admin_audit_log" + where
                        + " ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?",
                rowMapper(), pageParams.toArray());

        int totalPages = query.size() == 0 ? 0 : (int) Math.ceil((double) totalElements / query.size());
        return new AdminAuditPage(content, query.page(), query.size(), totalElements, totalPages);
    }

    private void insert(AdminAuditEntry entry) {
        jdbcTemplate.update("INSERT INTO admin_audit_log (" + COLUMNS + ") VALUES "
                        + "(?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), ?, ?, ?, ?)",
                entry.id(), timestamp(entry.occurredAt()), entry.actor().keycloakId(), entry.actor().username(),
                entry.action(), entry.targetType().name(), entry.targetId(), json(entry.before()), json(entry.after()),
                entry.actor().ipAddress(), entry.outcome().name(), entry.failureReason(),
                timestamp(entry.completedAt()));
    }

    private RowMapper<AdminAuditEntry> rowMapper() {
        return (rs, rowNum) -> new AdminAuditEntry(
                rs.getObject("id", UUID.class),
                instant(rs, "occurred_at"),
                new AuditActor(rs.getString("actor_keycloak_id"), rs.getString("actor_username"),
                        rs.getString("ip_address")),
                rs.getString("action"),
                AuditTargetType.valueOf(rs.getString("target_type")),
                rs.getString("target_id"),
                map(rs.getString("before_state")),
                map(rs.getString("after_state")),
                AuditOutcome.valueOf(rs.getString("outcome")),
                rs.getString("failure_reason"),
                instant(rs, "completed_at"));
    }

    private String json(Map<String, Object> value) {
        return value == null ? null : jsonMapper.writeValueAsString(value);
    }

    private Map<String, Object> map(String json) {
        return json == null ? null : jsonMapper.readValue(json, JSON_OBJECT);
    }

    private static Timestamp timestamp(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
