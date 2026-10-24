package chronos.dw.admin.domain.model;

import java.math.BigDecimal;
import java.time.Instant;

public record EtlExecutionMetric(String name, BigDecimal value, String unit, Instant measuredAt) {}
