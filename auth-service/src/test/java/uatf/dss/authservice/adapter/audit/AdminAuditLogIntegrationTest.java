package uatf.dss.authservice.adapter.audit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;
import uatf.dss.authservice.TestcontainersConfiguration;
import uatf.dss.authservice.application.port.in.AdminAuditPage;
import uatf.dss.authservice.application.port.in.ListAdminAuditQuery;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsCommand;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsUseCase;
import uatf.dss.authservice.application.port.out.AdminAuditLogRepository;
import uatf.dss.authservice.application.port.out.IdentityRoleMappingPort;
import uatf.dss.authservice.application.port.out.UserRepository;
import uatf.dss.authservice.domain.exception.notfound.UserNotFoundException;
import uatf.dss.authservice.domain.model.User;
import uatf.dss.authservice.domain.model.audit.AdminAuditEntry;
import uatf.dss.authservice.domain.model.identity.IdentityRole;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.audit.AuditOutcome;
import uatf.dss.authservice.domain.model.audit.AuditPayloadSanitizer;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@DisplayName("Admin audit log integration tests (PostgreSQL)")
class AdminAuditLogIntegrationTest {

    private static final AuditActor ANA = new AuditActor("kc-ana", "ana.admin", "203.0.113.9");
    private static final AuditActor LUIS = new AuditActor("kc-luis", "luis.sec", "198.51.100.4");

    @Autowired
    private AdminAuditLogRepository repository;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private TransactionTemplate transactionTemplate;
    @Autowired
    private SetUserAcademicContextsUseCase setContexts;
    @Autowired
    private UserRepository userRepository;
    // The academic scope is read live from Keycloak; here it is stubbed.
    @MockitoBean
    private IdentityRoleMappingPort identityMappings;

    @BeforeEach
    void cleanUp() {
        jdbcTemplate.execute("TRUNCATE TABLE admin_audit_log");
        jdbcTemplate.execute("TRUNCATE TABLE user_academic_contexts, user_roles, users CASCADE");
    }

    private static AdminAuditEntry entry(AuditActor actor, String action, AuditTargetType type, String targetId,
                                         Instant at, AuditOutcome outcome, Map<String, Object> after) {
        return new AdminAuditEntry(UUID.randomUUID(), at, actor, action, type, targetId, Map.of("name", "antes"),
                after, outcome, outcome == AuditOutcome.FAILURE ? "Fallo de prueba" : null,
                outcome == AuditOutcome.PENDING ? null : at);
    }

    private static ListAdminAuditQuery all(int page, int size) {
        return new ListAdminAuditQuery(null, null, null, null, null, null, null, page, size);
    }

    private long count() {
        Long rows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM admin_audit_log", Long.class);
        return rows == null ? 0 : rows;
    }

    @Test
    @DisplayName("V7 creates admin_audit_log and drops the unused Envers tables")
    void migrationReplacesEnversTables() {
        Integer envers = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM information_schema.tables "
                + "WHERE table_schema = current_schema() AND table_name IN ('revinfo', 'revchanges')", Integer.class);
        Integer audit = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM information_schema.tables "
                + "WHERE table_schema = current_schema() AND table_name = 'admin_audit_log'", Integer.class);
        assertThat(envers).isZero();
        assertThat(audit).isEqualTo(1);
    }

    @Test
    @DisplayName("Stores and reads back an entry, JSON snapshots included, with secrets redacted")
    void roundTripsEntriesWithJsonSnapshots() {
        AdminAuditEntry original = entry(ANA, "CLIENT_SECRET_ROTATED", AuditTargetType.CLIENT, "iam-app",
                Instant.parse("2026-11-20T10:00:00Z"), AuditOutcome.SUCCESS,
                Map.of("descripción", "Aplicación académica", "clientSecret", "s3cr3t",
                        "redirectUris", List.of("https://app.uatf.test/cb")));

        repository.appendIndependently(original);

        AdminAuditEntry stored = repository.search(all(0, 10)).content().getFirst();
        assertThat(stored.id()).isEqualTo(original.id());
        assertThat(stored.actor()).isEqualTo(ANA);
        assertThat(stored.occurredAt()).isEqualTo(original.occurredAt());
        assertThat(stored.after()).containsEntry("descripción", "Aplicación académica")
                .containsEntry("clientSecret", AuditPayloadSanitizer.REDACTED)
                .containsEntry("redirectUris", List.of("https://app.uatf.test/cb"));
        String raw = jdbcTemplate.queryForObject("SELECT after_state::text FROM admin_audit_log", String.class);
        assertThat(raw).doesNotContain("s3cr3t");
    }

    @Test
    @DisplayName("Filters by actor, action, target, outcome and date range, newest first, paginated")
    void searchesWithFiltersAndPagination() {
        Instant base = Instant.parse("2026-11-10T00:00:00Z");
        repository.appendIndependently(entry(ANA, "USER_CREATED", AuditTargetType.USER, "u-1", base, AuditOutcome.SUCCESS, null));
        repository.appendIndependently(entry(ANA, "USER_DISABLED", AuditTargetType.USER, "u-1", base.plusSeconds(3600), AuditOutcome.FAILURE, null));
        repository.appendIndependently(entry(LUIS, "ROLE_CREATED", AuditTargetType.ROLE, "COORDINADOR", base.plusSeconds(7200), AuditOutcome.SUCCESS, null));
        repository.appendIndependently(entry(LUIS, "USER_CREATED", AuditTargetType.USER, "u-2", base.plusSeconds(86400 * 30), AuditOutcome.SUCCESS, null));

        AdminAuditPage firstPage = repository.search(all(0, 3));
        assertThat(firstPage.totalElements()).isEqualTo(4);
        assertThat(firstPage.totalPages()).isEqualTo(2);
        assertThat(firstPage.content()).extracting(AdminAuditEntry::action)
                .containsExactly("USER_CREATED", "ROLE_CREATED", "USER_DISABLED");
        assertThat(repository.search(all(1, 3)).content()).extracting(AdminAuditEntry::targetId).containsExactly("u-1");

        assertThat(search("ana.admin", null, null, null, null, null, null)).hasSize(2);
        assertThat(search("kc-luis", null, null, null, null, null, null)).hasSize(2);
        assertThat(search(null, "USER_CREATED", null, null, null, null, null)).hasSize(2);
        assertThat(search(null, null, AuditTargetType.USER, "u-1", null, null, null)).hasSize(2);
        assertThat(search(null, null, null, null, AuditOutcome.FAILURE, null, null))
                .extracting(AdminAuditEntry::action).containsExactly("USER_DISABLED");
        assertThat(search(null, null, null, null, null, base, base.plusSeconds(7200)))
                .as("from inclusive, to exclusive").extracting(AdminAuditEntry::action)
                .containsExactly("USER_DISABLED", "USER_CREATED");
    }

    private List<AdminAuditEntry> search(String actor, String action, AuditTargetType type, String targetId,
                                         AuditOutcome outcome, Instant from, Instant to) {
        return repository.search(new ListAdminAuditQuery(actor, action, type, targetId, outcome, from, to, 0, 50))
                .content();
    }

    @Test
    @DisplayName("append joins the caller's transaction; appendIndependently survives its rollback")
    void writeModesFollowTheirTransactionSemantics() {
        AdminAuditEntry joined = entry(ANA, "USER_UPDATED", AuditTargetType.USER, "u-1", Instant.now(), AuditOutcome.SUCCESS, null);
        AdminAuditEntry independent = entry(ANA, "USER_UPDATED", AuditTargetType.USER, "u-1", Instant.now(), AuditOutcome.FAILURE, null);

        assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(status -> {
            repository.append(joined);
            repository.appendIndependently(independent);
            throw new IllegalStateException("rollback");
        })).hasMessage("rollback");

        assertThat(repository.search(all(0, 10)).content()).extracting(AdminAuditEntry::id)
                .containsExactly(independent.id());
    }

    @Test
    @DisplayName("A PENDING entry is completed in place")
    void completesPendingEntries() {
        AdminAuditEntry pending = entry(LUIS, "ROLE_CREATED", AuditTargetType.ROLE, "COORDINADOR", Instant.now(), AuditOutcome.PENDING, null);
        repository.appendIndependently(pending);

        repository.completeIndependently(pending.completed(AuditOutcome.SUCCESS, Map.of("name", "COORDINADOR"), null,
                Instant.now()));

        AdminAuditEntry stored = repository.search(all(0, 10)).content().getFirst();
        assertThat(count()).isEqualTo(1);
        assertThat(stored.outcome()).isEqualTo(AuditOutcome.SUCCESS);
        assertThat(stored.after()).containsEntry("name", "COORDINADOR");
        assertThat(stored.completedAt()).isNotNull();
    }

    @Test
    @DisplayName("End to end: a failed academic-context change still leaves a FAILURE row after the rollback")
    void failedAdministrativeOperationIsAudited() {
        UUID unknownUser = UUID.randomUUID();

        assertThatThrownBy(() -> setContexts.execute(new SetUserAcademicContextsCommand(ANA, unknownUser, List.of())))
                .isInstanceOf(UserNotFoundException.class);

        List<AdminAuditEntry> rows = repository.search(all(0, 10)).content();
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().outcome()).isEqualTo(AuditOutcome.FAILURE);
        assertThat(rows.getFirst().action()).isEqualTo("USER_ACADEMIC_CONTEXTS_REPLACED");
        assertThat(rows.getFirst().targetId()).isEqualTo(unknownUser.toString());
        assertThat(rows.getFirst().failureReason()).startsWith("UserNotFoundException");
    }

    @Test
    @DisplayName("End to end: a successful academic-context change is audited with its before and after state")
    void successfulAdministrativeOperationIsAudited() {
        User rector = userRepository.save(User.create(null, UUID.randomUUID(), "rector", "rector@uatf.edu.bo",
                "Rector", "UATF", true));
        userRepository.replaceRoleSnapshot(rector.id(), Set.of("RECTOR"));
        when(identityMappings.listUserClientRoles(rector.keycloakId().toString(), "dss-permissions", true))
                .thenReturn(List.of(new IdentityRole(UUID.randomUUID().toString(), "analytics:global", null, false,
                        false, Map.of())));

        setContexts.execute(new SetUserAcademicContextsCommand(ANA, rector.id(), List.of()));

        AdminAuditEntry row = repository.search(all(0, 10)).content().getFirst();
        assertThat(row.outcome()).isEqualTo(AuditOutcome.SUCCESS);
        assertThat(row.actor()).isEqualTo(ANA);
        assertThat(row.before()).containsEntry("academicContexts", List.of());
        assertThat(row.after()).containsEntry("academicContexts", List.of());
    }
}
