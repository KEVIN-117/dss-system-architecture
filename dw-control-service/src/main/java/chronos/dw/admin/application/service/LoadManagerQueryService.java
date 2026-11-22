package chronos.dw.admin.application.service;

import chronos.dw.admin.application.model.ExecutionPage;
import chronos.dw.admin.application.port.in.QueryLoadManagerUseCase;
import chronos.dw.admin.application.port.out.EtlLaunchPort;
import chronos.dw.admin.application.port.out.EtlProcessCatalogPort;
import chronos.dw.admin.application.port.out.HopExecutionPort;
import chronos.dw.admin.application.port.out.QueryEtlLaunchesPort;
import chronos.dw.admin.configuration.EtlProperties;
import chronos.dw.admin.domain.exception.EtlLaunchNotFoundException;
import chronos.dw.admin.domain.exception.HopUnavailableException;
import chronos.dw.admin.domain.model.EtlLaunch;
import chronos.dw.admin.domain.model.EtlLaunchSearchCriteria;
import chronos.dw.admin.domain.model.EtlProcess;
import chronos.dw.admin.domain.model.LoadManagerHealth;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.stereotype.Service;

/** Read side of the Load Manager. The health check also feeds the {@code etl.hop.up} gauge. */
@Service
public class LoadManagerQueryService implements QueryLoadManagerUseCase {

    static final int ACTIVE_LIMIT = 50;

    private final EtlProcessCatalogPort catalog;
    private final EtlLaunchPort launches;
    private final QueryEtlLaunchesPort launchQueries;
    private final HopExecutionPort hop;
    private final OperatingWindowPolicy operatingWindow;
    private final EtlProperties properties;
    private final Clock clock;
    private final AtomicInteger hopUp = new AtomicInteger(0);

    public LoadManagerQueryService(
            EtlProcessCatalogPort catalog,
            EtlLaunchPort launches,
            QueryEtlLaunchesPort launchQueries,
            HopExecutionPort hop,
            OperatingWindowPolicy operatingWindow,
            EtlProperties properties,
            Clock clock,
            MeterRegistry meterRegistry) {
        this.catalog = catalog;
        this.launches = launches;
        this.launchQueries = launchQueries;
        this.hop = hop;
        this.operatingWindow = operatingWindow;
        this.properties = properties;
        this.clock = clock;
        Gauge.builder("etl.hop.up", hopUp, AtomicInteger::get)
                .description("1 when the last Hop Server status check succeeded")
                .register(meterRegistry);
    }

    @Override
    public List<EtlProcess> processes() {
        return catalog.findAll();
    }

    @Override
    public ExecutionPage<EtlLaunch> launches(EtlLaunchSearchCriteria criteria, int page, int size) {
        return launchQueries.find(criteria == null ? EtlLaunchSearchCriteria.none() : criteria, page, size);
    }

    @Override
    public EtlLaunch launch(UUID launchId) {
        return launches.findById(launchId).orElseThrow(() -> new EtlLaunchNotFoundException(launchId));
    }

    @Override
    public List<EtlLaunch> activeLaunches() {
        return launches.findActive(ACTIVE_LIMIT);
    }

    @Override
    public LoadManagerHealth health() {
        String hopStatus;
        try {
            hopStatus = hop.serverStatus();
        } catch (HopUnavailableException exception) {
            hopStatus = null;
        }
        boolean online = hopStatus != null
                && hopStatus.toLowerCase(java.util.Locale.ROOT).startsWith("online");
        hopUp.set(online ? 1 : 0);
        return new LoadManagerHealth(
                online,
                hopStatus,
                properties.monitoring().enabled(),
                properties.scheduler().enabled(),
                operatingWindow.describe(),
                clock.instant());
    }
}
