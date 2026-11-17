package chronos.dw.admin.domain.model;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Métrica de una ejecución ETL.
 *
 * @param source contrato de origen que la produjo (p. ej. {@code academico.alumnos}), o {@code null}
 * @param stepCode código del paso asociado, o {@code null} si la métrica es de la ejecución completa
 */
public record EtlExecutionMetric(
        String name, BigDecimal value, String unit, Instant measuredAt, String source, String stepCode) {}
