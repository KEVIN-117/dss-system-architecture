/*
 *   Copyright 2026 Spicule Ltd
 *   Apache License, Version 2.0.
 */
package org.saiku.launcher.it;

import static org.junit.Assert.*;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.http.HttpResponse;
import org.junit.BeforeClass;
import org.junit.Test;

/**
 * Smoke test: the launcher comes up, the {@code /rest/saiku/info} endpoint
 * answers, and the response body is a JSON list. This is the gating IT — if
 * this is red, the rest of the IT surface is meaningless.
 */
public class InfoEndpointIT {

    private static SaikuItHarness harness;

    @BeforeClass
    public static void boot() throws Exception {
        harness = SaikuItHarness.shared();
    }

    @Test
    public void info_returns200WithJsonArray() throws Exception {
        HttpResponse<String> resp = harness.getAuth("/rest/saiku/info");
        assertEquals("info should be 200, body was: " + resp.body(), 200, resp.statusCode());
        JsonNode body = harness.parse(resp);
        assertTrue("info body must be a JSON array (plugin list), got: " + resp.body(), body.isArray());
    }

    @Test
    public void info_unauthenticatedAlsoAllowed() throws Exception {
        // /info remains public so API clients can discover service capabilities
        // before authentication. Lock that contract against accidental changes.
        HttpResponse<String> resp = harness.getAnon("/rest/saiku/info");
        assertEquals(200, resp.statusCode());
    }

    @Test
    public void swaggerUi_isPublicHtml() throws Exception {
        HttpResponse<String> resp = harness.getAnon("/swagger-ui.html", "text/html");

        assertEquals("Swagger UI should be public: " + resp.body(), 200, resp.statusCode());
        assertTrue(resp.headers().firstValue("Content-Type").orElse("").contains("text/html"));
        assertTrue("expected the Saiku Swagger page", resp.body().contains("Saiku API - Swagger UI"));
    }

    @Test
    public void openApiJson_isPublicAndContainsTheApiDocument() throws Exception {
        HttpResponse<String> resp = harness.getAnon("/rest/openapi.json", "application/json");

        assertEquals("OpenAPI JSON should be public: " + resp.body(), 200, resp.statusCode());
        assertTrue(resp.headers().firstValue("Content-Type").orElse("").contains("json"));
        assertTrue("expected an OpenAPI document", resp.body().contains("\"openapi\""));
        assertTrue(
                "expected endpoint paths in the OpenAPI document", resp.body().contains("\"paths\""));
    }

    @Test
    public void openApiYaml_isPublicAndContainsTheApiDocument() throws Exception {
        HttpResponse<String> resp = harness.getAnon("/rest/openapi.yaml", "application/yaml");

        assertEquals("OpenAPI YAML should be public: " + resp.body(), 200, resp.statusCode());
        assertTrue(resp.body().contains("openapi:"));
        assertTrue(resp.body().contains("paths:"));
    }
}
