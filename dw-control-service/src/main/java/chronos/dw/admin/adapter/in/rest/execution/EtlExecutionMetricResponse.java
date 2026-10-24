package chronos.dw.admin.adapter.in.rest.execution;

import chronos.dw.admin.domain.model.EtlExecutionMetric;
import java.math.BigDecimal;
import java.time.Instant;

public record EtlExecutionMetricResponse(String name, BigDecimal value, String unit, Instant measuredAt) {

    public static EtlExecutionMetricResponse from(EtlExecutionMetric metric) {
        return new EtlExecutionMetricResponse(metric.name(), metric.value(), metric.unit(), metric.measuredAt());
    }
}
