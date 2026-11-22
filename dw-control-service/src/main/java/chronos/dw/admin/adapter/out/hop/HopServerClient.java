package chronos.dw.admin.adapter.out.hop;

import chronos.dw.admin.application.port.out.HopExecutionPort;
import chronos.dw.admin.configuration.EtlProperties;
import chronos.dw.admin.domain.exception.HopRequestRejectedException;
import chronos.dw.admin.domain.exception.HopUnavailableException;
import chronos.dw.admin.domain.model.HopRunStatus;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Hop Server adapter (LM-001 contract, docs/dw/hop-server-contract.md). Executions are registered as the Load
 * Manager launcher and started asynchronously; {@code /hop/execWorkflow} is not used because it blocks until the
 * workflow ends and returns no id.
 */
@Component
public class HopServerClient implements HopExecutionPort {

    private static final Logger LOG = LoggerFactory.getLogger(HopServerClient.class);

    private final RestClient restClient;
    private final String projectHome;

    public HopServerClient(@Qualifier("hopServerRestClient") RestClient restClient, EtlProperties properties) {
        this.restClient = restClient;
        this.projectHome = properties.hop().projectHome();
    }

    @Override
    public String serverStatus() {
        String body = call("status", () -> restClient
                .get()
                .uri(uri -> uri.path("/hop/status/").queryParam("json", "Y").build())
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (request, response) -> {
                    throw unavailable("status", response.getStatusCode());
                })
                .body(String.class));
        return HopResponses.serverStatus(body);
    }

    @Override
    public UUID submit(String workflowFile, Map<String, String> parameters) {
        String request = HopLauncherWorkflow.build(projectHome, workflowFile, parameters);
        String registered = call("registerWorkflow", () -> restClient
                .post()
                .uri(uri -> uri.path("/hop/registerWorkflow/")
                        .queryParam("xml", "Y")
                        .build())
                .contentType(MediaType.TEXT_XML)
                .body(request)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (req, response) -> {
                    throw unavailable("registerWorkflow", response.getStatusCode());
                })
                .body(String.class));
        UUID executionId = HopResponses.webResultId(registered, "registerWorkflow");
        if (executionId == null) {
            throw new HopUnavailableException("Hop Server registered the workflow without an execution id");
        }

        try {
            HopResponses.webResultId(workflowCommand("startWorkflow", executionId), "startWorkflow");
        } catch (RuntimeException exception) {
            remove(executionId);
            throw exception;
        }
        return executionId;
    }

    @Override
    public HopRunStatus status(UUID hopExecutionId) {
        Objects.requireNonNull(hopExecutionId, "hopExecutionId is required");
        return HopResponses.workflowStatus(workflowCommand("workflowStatus", hopExecutionId));
    }

    @Override
    public void stop(UUID hopExecutionId) {
        Objects.requireNonNull(hopExecutionId, "hopExecutionId is required");
        String body = workflowCommand("stopWorkflow", hopExecutionId);
        if (body != null && body.contains("could not be found")) {
            throw new HopRequestRejectedException("Hop Server no longer knows execution " + hopExecutionId);
        }
        HopResponses.webResultId(body, "stopWorkflow");
    }

    @Override
    public void remove(UUID hopExecutionId) {
        if (hopExecutionId == null) {
            return;
        }
        try {
            workflowCommand("removeWorkflow", hopExecutionId);
        } catch (RuntimeException exception) {
            LOG.debug("Could not remove Hop execution {} from the server: {}", hopExecutionId, exception.getMessage());
        }
    }

    private String workflowCommand(String operation, UUID executionId) {
        return call(operation, () -> restClient
                .get()
                .uri(uri -> uri.path("/hop/" + operation + "/")
                        .queryParam("name", HopLauncherWorkflow.NAME)
                        .queryParam("id", executionId.toString())
                        .queryParam("xml", "Y")
                        .build())
                .retrieve()
                .onStatus(HttpStatusCode::isError, (request, response) -> {
                    throw unavailable(operation, response.getStatusCode());
                })
                .body(String.class));
    }

    private static String call(String operation, Supplier<String> request) {
        try {
            return request.get();
        } catch (HopUnavailableException | HopRequestRejectedException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new HopUnavailableException("Hop Server is not reachable (" + operation + ")", exception);
        }
    }

    private static HopUnavailableException unavailable(String operation, HttpStatusCode status) {
        if (status.value() == 401 || status.value() == 403) {
            return new HopUnavailableException("Hop Server rejected the credentials (" + operation + ")");
        }
        return new HopUnavailableException("Hop Server answered HTTP " + status.value() + " (" + operation + ")");
    }
}
