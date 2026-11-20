package uatf.dss.authservice.domain.audit;

import org.junit.jupiter.api.Test;
import uatf.dss.authservice.domain.model.audit.AdminAuditEntry;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.domain.model.audit.AuditOutcome;
import uatf.dss.authservice.domain.model.audit.AuditPayloadSanitizer;
import uatf.dss.authservice.domain.model.audit.AuditTargetType;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AdminAuditEntryTest {

    private static AdminAuditEntry entry(Map<String, Object> before, Map<String, Object> after, String reason) {
        return new AdminAuditEntry(UUID.randomUUID(), Instant.parse("2026-11-20T10:00:00Z"),
                new AuditActor("kc-1", "ana.admin", "10.0.0.1"), "CLIENT_SECRET_ROTATED", AuditTargetType.CLIENT,
                "iam-app", before, after, AuditOutcome.SUCCESS, reason, Instant.parse("2026-11-20T10:00:01Z"));
    }

    @Test
    void secretsAreRedactedAtAnyDepthBeforeStorage() {
        Map<String, Object> credential = new LinkedHashMap<>();
        credential.put("type", "password");
        credential.put("temporaryPassword", "Hunter2!");
        Map<String, Object> after = new LinkedHashMap<>();
        after.put("clientId", "iam-app");
        after.put("clientSecret", "s3cr3t");
        after.put("credentials", List.of(credential));
        after.put("nested", Map.of("accessToken", "eyJ...", "api_key", "k", "enabled", true));

        AdminAuditEntry audit = entry(null, after, null);

        assertThat(audit.after()).containsEntry("clientId", "iam-app")
                .containsEntry("clientSecret", AuditPayloadSanitizer.REDACTED)
                .containsEntry("credentials", AuditPayloadSanitizer.REDACTED);
        @SuppressWarnings("unchecked")
        Map<String, Object> nested = (Map<String, Object>) audit.after().get("nested");
        assertThat(nested).containsEntry("accessToken", AuditPayloadSanitizer.REDACTED)
                .containsEntry("api_key", AuditPayloadSanitizer.REDACTED)
                .containsEntry("enabled", true);
        assertThat(audit.toString()).doesNotContain("s3cr3t").doesNotContain("Hunter2!").doesNotContain("eyJ");
    }

    @Test
    void redactsInsideListsAndKeepsOrdinaryValues() {
        Map<String, Object> user = new HashMap<>();
        user.put("username", "ana");
        user.put("password", "x");
        Map<String, Object> before = Map.of("users", List.of(user), "count", 1);

        AdminAuditEntry audit = entry(before, null, null);

        @SuppressWarnings("unchecked")
        Map<String, Object> first = ((List<Map<String, Object>>) audit.before().get("users")).getFirst();
        assertThat(first).containsEntry("username", "ana").containsEntry("password", AuditPayloadSanitizer.REDACTED);
        assertThat(audit.before()).containsEntry("count", 1);
        assertThat(audit.after()).isNull();
    }

    @Test
    void snapshotsAreImmutableCopies() {
        Map<String, Object> after = new HashMap<>(Map.of("name", "DECANO"));
        AdminAuditEntry audit = entry(null, after, null);
        after.put("name", "changed");

        assertThat(audit.after()).containsEntry("name", "DECANO");
        assertThatThrownBy(() -> audit.after().put("x", 1)).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void longFailureReasonsAreTruncated() {
        AdminAuditEntry audit = entry(null, null, "x".repeat(5000));

        assertThat(audit.failureReason()).hasSize(AdminAuditEntry.MAX_FAILURE_REASON);
    }

    @Test
    void requiresActionAndDefaultsToSystemActor() {
        assertThatThrownBy(() -> new AdminAuditEntry(UUID.randomUUID(), Instant.now(), null, " ", AuditTargetType.USER,
                null, null, null, AuditOutcome.SUCCESS, null, null)).isInstanceOf(IllegalArgumentException.class);

        AdminAuditEntry system = new AdminAuditEntry(UUID.randomUUID(), Instant.now(), null, "USER_SYNCED",
                AuditTargetType.USER, null, null, null, AuditOutcome.SUCCESS, null, null);
        assertThat(system.actor()).isEqualTo(AuditActor.SYSTEM);
    }
}
