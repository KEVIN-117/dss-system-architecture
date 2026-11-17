package chronos.dw.admin.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import chronos.dw.admin.application.model.ExecutionPage;
import chronos.dw.admin.application.port.out.QueryEtlExecutionsPort;
import chronos.dw.admin.domain.model.EtlExecutionDetail;
import chronos.dw.admin.domain.model.EtlExecutionError;
import chronos.dw.admin.domain.model.EtlExecutionKind;
import chronos.dw.admin.domain.model.EtlExecutionMetric;
import chronos.dw.admin.domain.model.EtlExecutionSearchCriteria;
import chronos.dw.admin.domain.model.EtlExecutionStatus;
import chronos.dw.admin.domain.model.EtlExecutionStep;
import chronos.dw.admin.domain.model.EtlExecutionSummary;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class QueryEtlExecutionsServiceTest {

    private static final UUID RUN_ID = UUID.fromString("4d96742f-1c2b-4f7e-9a11-2b7f0c5d8e90");
    private static final Instant NOW = Instant.parse("2026-11-13T14:54:00Z");

    @Test
    void exposesSafeMetricSourceAndStepAndDropsUnsafeOnes() {
        List<EtlExecutionMetric> metrics = List.of(
                new EtlExecutionMetric(
                        "source_rows_observed",
                        BigDecimal.valueOf(107560),
                        "ROWS",
                        NOW,
                        "academico.alumnos",
                        "source_alumnos"),
                new EtlExecutionMetric(
                        "source_rows_observed",
                        BigDecimal.valueOf(23),
                        "ROWS",
                        NOW,
                        "<script>alert(1)</script>",
                        "paso con espacios"),
                new EtlExecutionMetric("student_snapshot_rows", BigDecimal.TEN, "ROWS", NOW, null, null));

        QueryEtlExecutionsService service = new QueryEtlExecutionsService(new FakePort(metrics));
        EtlExecutionDetail detail = service.get(RUN_ID);

        EtlExecutionMetric safe = detail.metrics().get(0);
        assertEquals("academico.alumnos", safe.source());
        assertEquals("source_alumnos", safe.stepCode());

        EtlExecutionMetric unsafe = detail.metrics().get(1);
        assertNull(unsafe.source());
        assertNull(unsafe.stepCode());
        assertEquals("source_rows_observed", unsafe.name());

        EtlExecutionMetric withoutContext = detail.metrics().get(2);
        assertNull(withoutContext.source());
        assertNull(withoutContext.stepCode());
    }

    private record FakePort(List<EtlExecutionMetric> metrics) implements QueryEtlExecutionsPort {

        @Override
        public ExecutionPage<EtlExecutionSummary> find(EtlExecutionSearchCriteria criteria, int page, int size) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<EtlExecutionSummary> findSummary(UUID runId) {
            return Optional.of(new EtlExecutionSummary(
                    runId,
                    EtlExecutionKind.CIERRE_ACADEMICO,
                    EtlExecutionStatus.EN_EJECUCION,
                    1L,
                    2002,
                    1,
                    "admin",
                    NOW,
                    NOW,
                    null));
        }

        @Override
        public List<EtlExecutionStep> findSteps(UUID runId) {
            return List.of();
        }

        @Override
        public List<EtlExecutionMetric> findMetrics(UUID runId) {
            return metrics;
        }

        @Override
        public List<EtlExecutionError> findSanitizedErrorMetadata(UUID runId) {
            return List.of();
        }
    }
}
