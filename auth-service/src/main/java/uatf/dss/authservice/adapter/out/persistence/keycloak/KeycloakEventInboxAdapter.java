package uatf.dss.authservice.adapter.out.persistence.keycloak;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import uatf.dss.authservice.application.port.out.KeycloakEventInboxRepository;

@Repository
public class KeycloakEventInboxAdapter implements KeycloakEventInboxRepository {
    private final JdbcTemplate jdbcTemplate;

    public KeycloakEventInboxAdapter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public boolean markAsProcessed(String eventId) {
        int inserted = jdbcTemplate.update(
                "INSERT INTO processed_keycloak_events (event_id) VALUES (?) ON CONFLICT (event_id) DO NOTHING",
                eventId);
        return inserted == 1;
    }
}
