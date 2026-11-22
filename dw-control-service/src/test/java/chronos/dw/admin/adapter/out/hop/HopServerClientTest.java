package chronos.dw.admin.adapter.out.hop;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import chronos.dw.admin.configuration.EtlProperties;
import chronos.dw.admin.configuration.LoadManagerConfiguration;
import chronos.dw.admin.domain.exception.HopRequestRejectedException;
import chronos.dw.admin.domain.exception.HopUnavailableException;
import chronos.dw.admin.domain.model.HopRunStatus;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.ConnectException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.zip.GZIPOutputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class HopServerClientTest {

    private static final UUID EXECUTION_ID = UUID.fromString("f059347e-e3ec-49c2-99af-6848d62ea2e2");
    private static final String BASE = "http://hop-server:8080";

    private MockRestServiceServer server;
    private HopServerClient client;

    @BeforeEach
    void setUp() {
        EtlProperties properties = new EtlProperties(
                new EtlProperties.Hop(URI.create(BASE), "dw-control", "secret-password-123", null, null, null),
                null,
                null);
        RestClient.Builder builder = RestClient.builder().baseUrl(BASE);
        LoadManagerConfiguration.applyCredentials(builder, properties.hop());
        server = MockRestServiceServer.bindTo(builder).build();
        client = new HopServerClient(builder.build(), properties);
    }

    @Test
    void submitRegistersTheLauncherAndStartsIt() {
        server.expect(requestTo(BASE + "/hop/registerWorkflow/?xml=Y"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(
                        content()
                                .string(
                                        containsString(
                                                "<name>P_TARGET_WORKFLOW</name><value>/files/project/workflows/wf_hop_publish_staged_run.hwf</value>")))
                .andExpect(content()
                        .string(containsString(
                                "<name>P_RUN_ID</name><value>7e57da7a-0000-4000-8000-00000000abcd</value>")))
                .andExpect(content().string(containsString("<metastore_json>H4sI")))
                .andRespond(withSuccess(webResult("OK", "added", EXECUTION_ID.toString()), MediaType.TEXT_XML));
        server.expect(requestTo(BASE + "/hop/startWorkflow/?name=dss_lm_launcher&id=" + EXECUTION_ID + "&xml=Y"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(webResult("OK", "started", EXECUTION_ID.toString()), MediaType.TEXT_XML));

        UUID id = client.submit(
                "workflows/wf_hop_publish_staged_run.hwf", Map.of("P_RUN_ID", "7e57da7a-0000-4000-8000-00000000abcd"));

        assertEquals(EXECUTION_ID, id);
        server.verify();
    }

    @Test
    void failedStartRemovesTheRegisteredExecution() {
        server.expect(requestTo(BASE + "/hop/registerWorkflow/?xml=Y"))
                .andRespond(withSuccess(webResult("OK", "added", EXECUTION_ID.toString()), MediaType.TEXT_XML));
        server.expect(requestTo(BASE + "/hop/startWorkflow/?name=dss_lm_launcher&id=" + EXECUTION_ID + "&xml=Y"))
                .andRespond(withSuccess(webResult("ERROR", "could not start", ""), MediaType.TEXT_XML));
        server.expect(requestTo(BASE + "/hop/removeWorkflow/?name=dss_lm_launcher&id=" + EXECUTION_ID + "&xml=Y"))
                .andRespond(withSuccess(webResult("OK", "", ""), MediaType.TEXT_XML));

        assertThrows(
                HopRequestRejectedException.class,
                () -> client.submit("workflows/wf_sync_academic_catalog.hwf", Map.of()));
        server.verify();
    }

    @Test
    void rejectedRegistrationIsReported() {
        server.expect(requestTo(BASE + "/hop/registerWorkflow/?xml=Y"))
                .andRespond(withSuccess(webResult("ERROR", "metadata plugin for key null", ""), MediaType.TEXT_XML));

        HopRequestRejectedException exception = assertThrows(
                HopRequestRejectedException.class,
                () -> client.submit("workflows/wf_sync_academic_catalog.hwf", Map.of()));
        assertTrue(exception.getMessage().contains("metadata plugin"));
    }

    @Test
    void statusDecodesTheLogAndMapsHopStates() throws IOException {
        server.expect(requestTo(BASE + "/hop/workflowStatus/?name=dss_lm_launcher&id=" + EXECUTION_ID + "&xml=Y"))
                .andRespond(withSuccess(status("Finished (with errors)", "ERROR: fallo"), MediaType.TEXT_XML));
        server.expect(requestTo(BASE + "/hop/workflowStatus/?name=dss_lm_launcher&id=" + EXECUTION_ID + "&xml=Y"))
                .andRespond(withSuccess(status("Running", "en curso"), MediaType.TEXT_XML));

        HopRunStatus failed = client.status(EXECUTION_ID);
        HopRunStatus running = client.status(EXECUTION_ID);

        assertEquals(HopRunStatus.State.FAILED, failed.state());
        assertEquals("ERROR: fallo", failed.log());
        assertEquals(HopRunStatus.State.RUNNING, running.state());
    }

    @Test
    void unknownExecutionIsNotFound() {
        server.expect(requestTo(BASE + "/hop/workflowStatus/?name=dss_lm_launcher&id=" + EXECUTION_ID + "&xml=Y"))
                .andRespond(withSuccess(
                        "<H1>Workflow &#39;dss_lm_launcher&#39; could not be found.</H1>", MediaType.TEXT_HTML));

        assertEquals(HopRunStatus.State.NOT_FOUND, client.status(EXECUTION_ID).state());
    }

    @Test
    void stopAsksHopToStopTheLauncher() {
        server.expect(requestTo(BASE + "/hop/stopWorkflow/?name=dss_lm_launcher&id=" + EXECUTION_ID + "&xml=Y"))
                .andExpect(queryParam("name", "dss_lm_launcher"))
                .andRespond(withSuccess(webResult("OK", "stop requested", ""), MediaType.TEXT_XML));

        client.stop(EXECUTION_ID);
        server.verify();
    }

    @Test
    void sendsBasicAuthAndMapsAuthenticationAndNetworkErrors() {
        server.expect(requestTo(BASE + "/hop/status/?json=Y"))
                .andExpect(request -> assertEquals(
                        "Basic "
                                + Base64.getEncoder()
                                        .encodeToString(
                                                "dw-control:secret-password-123".getBytes(StandardCharsets.UTF_8)),
                        request.getHeaders().getFirst("Authorization")))
                .andRespond(withSuccess("{ \"statusDescription\" : \"Online\" }", MediaType.APPLICATION_JSON));
        server.expect(requestTo(BASE + "/hop/status/?json=Y")).andRespond(withStatus(HttpStatus.UNAUTHORIZED));
        server.expect(requestTo(BASE + "/hop/status/?json=Y")).andRespond(withException(new ConnectException("down")));

        assertEquals("Online", client.serverStatus());
        HopUnavailableException unauthorized = assertThrows(HopUnavailableException.class, client::serverStatus);
        assertTrue(unauthorized.getMessage().contains("credentials"));
        assertThrows(HopUnavailableException.class, client::serverStatus);
    }

    @Test
    void doesNotSendInvalidParameters() {
        assertThrows(
                IllegalArgumentException.class,
                () -> client.submit("workflows/wf_sync_academic_catalog.hwf", Map.of("P_TARGET_WORKFLOW", "/etc")));
        assertThrows(IllegalArgumentException.class, () -> client.submit("../secrets.hwf", Map.of()));
        server.verify();
    }

    @Test
    void launcherEscapesParameterValues() {
        String xml = HopLauncherWorkflow.build(
                "/files/project/", "workflows/wf_x.hwf", Map.of("P_REQUESTED_GESTION", "<2026&\"'>"));

        assertTrue(xml.contains("<value>&lt;2026&amp;&quot;&apos;&gt;</value>"));
        assertTrue(xml.contains("<value>/files/project/workflows/wf_x.hwf</value>"));
        assertTrue(xml.contains("<filename>${P_TARGET_WORKFLOW}</filename>"));
        assertThrows(
                IllegalArgumentException.class,
                () -> HopLauncherWorkflow.build("/p", "workflows/wf_x.hwf", Map.of("P_X", "line\nbreak")));
        assertThrows(
                IllegalArgumentException.class,
                () -> HopLauncherWorkflow.build("/p", "workflows/wf_x.hwf", Map.of("not-hop", "x")));
    }

    @Test
    void rejectsXmlWithDoctypeDeclarations() {
        String xxe = "<?xml version=\"1.0\"?><!DOCTYPE r [<!ENTITY x SYSTEM \"file:///etc/passwd\">]>"
                + "<webresult><result>OK</result><id>&x;</id></webresult>";

        assertThrows(HopUnavailableException.class, () -> HopResponses.webResultId(xxe, "test"));
        org.hamcrest.MatcherAssert.assertThat(HopResponses.decodeLog("not-base64!"), not(containsString("x")));
    }

    private static String webResult(String result, String message, String id) {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<webresult>\n  <result>" + result + "</result>\n  <message>"
                + message + "</message>\n  <id>" + id + "</id>\n</webresult>\n";
    }

    private static String status(String description, String log) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (GZIPOutputStream gzip = new GZIPOutputStream(bytes)) {
            gzip.write(log.getBytes(StandardCharsets.UTF_8));
        }
        String encoded = Base64.getEncoder().encodeToString(bytes.toByteArray());
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<workflow-status>\n  <workflowname>dss_lm_launcher</workflowname>\n"
                + "  <id>" + EXECUTION_ID + "</id>\n  <status_desc>" + description + "</status_desc>\n  <error_desc/>\n"
                + "  <logging_string>&lt;![CDATA[" + encoded + "]]&gt;</logging_string>\n</workflow-status>\n";
    }
}
