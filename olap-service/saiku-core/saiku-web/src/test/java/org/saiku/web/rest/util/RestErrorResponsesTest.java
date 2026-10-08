/*
 *   Copyright 2026 Spicule Ltd
 *   Apache License, Version 2.0.
 */
package org.saiku.web.rest.util;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;

import jakarta.ws.rs.core.Response;
import java.sql.SQLException;
import java.util.Map;
import org.junit.Test;
import org.saiku.web.rest.objects.resultset.QueryResult;

public class RestErrorResponsesTest {

    @Test
    public void jdbcConnectionFailureMapsToOpaque503() {
        String secret = "jdbc:postgresql://dw/private?user=svc&password=secret";
        Response response = RestErrorResponses.jsonFailure(new SQLException(secret, "08001"));

        assertEquals(503, response.getStatus());
        Map<?, ?> body = (Map<?, ?>) response.getEntity();
        assertEquals("OLAP_CONNECTION_FAILED", body.get("code"));
        assertEquals("OLAP datasource unavailable", body.get("error"));
        assertFalse(body.toString().contains("password=secret"));
    }

    @Test
    public void internalQueryFailureHasOpaqueEnvelopeAndCorrelationRef() {
        String secret = "jdbc:postgresql://dw/private?user=svc&password=secret";
        Response response = RestErrorResponses.queryFailure(new IllegalStateException(secret));

        assertEquals(500, response.getStatus());
        QueryResult body = (QueryResult) response.getEntity();
        assertEquals("INTERNAL_ERROR", body.getCode());
        assertEquals("Internal error", body.getError());
        assertNotNull(body.getRef());
        assertFalse(body.getError().contains("password=secret"));
    }

    @Test
    public void sqlSyntaxStateMapsToInvalidQuery() {
        RestErrorResponses.Error error = RestErrorResponses.classify(new SQLException("syntax", "42601"));

        assertEquals(400, error.httpStatus());
        assertEquals("INVALID_QUERY", error.code());
    }
}
