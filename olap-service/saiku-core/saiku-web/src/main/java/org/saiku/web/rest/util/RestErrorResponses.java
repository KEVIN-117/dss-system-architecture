/*
 *   Copyright 2026 Spicule Ltd
 *   Apache License, Version 2.0.
 */
package org.saiku.web.rest.util;

import com.fasterxml.jackson.databind.JsonMappingException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.sql.SQLException;
import java.sql.SQLNonTransientConnectionException;
import java.sql.SQLRecoverableException;
import java.sql.SQLTransientConnectionException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import mondrian.olap.MondrianException;
import mondrian.olap.ResourceLimitExceededException;
import mondrian.olap.ResultLimitExceededException;
import org.olap4j.OlapException;
import org.saiku.olap.util.exception.SaikuOlapException;
import org.saiku.service.util.exception.SaikuAccessDeniedException;
import org.saiku.web.rest.objects.resultset.QueryResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Builds information-safe, consistently classified REST errors for OLAP operations. */
public final class RestErrorResponses {

    private static final Logger log = LoggerFactory.getLogger(RestErrorResponses.class);

    private RestErrorResponses() {}

    /** Stable public contract shared by the JAX-RS mapper and OLAP resources. */
    public record Error(String status, String code, String message, String ref, int httpStatus) {}

    public static Error classify(Throwable failure) {
        if (hasCause(failure, SaikuAccessDeniedException.class)) {
            return new Error("FORBIDDEN", "ACCESS_DENIED", "Access denied", null, 403);
        }
        if (isConnectionFailure(failure)) {
            return new Error("ERROR", "OLAP_CONNECTION_FAILED", "OLAP datasource unavailable", null, 503);
        }
        if (hasCause(failure, IllegalArgumentException.class) || hasCause(failure, JsonMappingException.class)) {
            return new Error("BAD_REQUEST", "INVALID_REQUEST", "Invalid request", null, 400);
        }
        if (isInvalidQuery(failure)) {
            return new Error("BAD_REQUEST", "INVALID_QUERY", "Invalid OLAP query", null, 400);
        }
        String ref = UUID.randomUUID().toString();
        log.error("Unhandled OLAP request failure [ref={}]", ref, failure);
        return new Error("ERROR", "INTERNAL_ERROR", "Internal error", ref, 500);
    }

    public static Response queryFailure(Throwable failure) {
        Error error = classify(failure);
        QueryResult body = new QueryResult(error.message());
        body.setStatus(error.status());
        body.setCode(error.code());
        body.setRef(error.ref());
        return Response.status(error.httpStatus())
                .entity(body)
                .type(MediaType.APPLICATION_JSON)
                .build();
    }

    public static Response jsonFailure(Throwable failure) {
        Error error = classify(failure);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", error.status());
        body.put("code", error.code());
        body.put("error", error.message());
        if (error.ref() != null) body.put("ref", error.ref());
        return Response.status(error.httpStatus())
                .entity(body)
                .type(MediaType.APPLICATION_JSON)
                .build();
    }

    private static boolean isConnectionFailure(Throwable failure) {
        for (Throwable current : causes(failure)) {
            if (current instanceof SQLTransientConnectionException
                    || current instanceof SQLNonTransientConnectionException
                    || current instanceof SQLRecoverableException) {
                return true;
            }
            if (current instanceof SQLException sql) {
                String state = sql.getSQLState();
                if (state != null && state.startsWith("08")) return true;
            }
        }
        return false;
    }

    private static boolean isInvalidQuery(Throwable failure) {
        boolean sawMondrian = false;
        for (Throwable current : causes(failure)) {
            if (current instanceof SaikuOlapException) return true;
            if (current instanceof ResultLimitExceededException || current instanceof ResourceLimitExceededException) {
                return false;
            }
            if (current instanceof SQLException sql && !(current instanceof OlapException)) {
                return "42601".equals(sql.getSQLState());
            }
            if (current instanceof MondrianException) sawMondrian = true;
        }
        return sawMondrian;
    }

    private static boolean hasCause(Throwable failure, Class<? extends Throwable> type) {
        for (Throwable current : causes(failure)) {
            if (type.isInstance(current)) return true;
        }
        return false;
    }

    private static Throwable next(Throwable current) {
        return current.getCause() == current ? null : current.getCause();
    }

    private static Iterable<Throwable> causes(Throwable failure) {
        Set<Throwable> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        java.util.List<Throwable> chain = new java.util.ArrayList<>();
        for (Throwable current = failure; current != null && seen.add(current); current = next(current)) {
            chain.add(current);
        }
        return chain;
    }
}
