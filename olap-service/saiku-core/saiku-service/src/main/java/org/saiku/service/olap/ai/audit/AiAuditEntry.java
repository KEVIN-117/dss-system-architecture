/*
 *   Copyright 2026 Spicule Ltd
 *   Licensed under the Apache License, Version 2.0.
 */
package org.saiku.service.olap.ai.audit;

/** One privacy-conscious record of an AI or embedded analytical request. */
public class AiAuditEntry {

    public static final String OUTCOME_SUCCESS = "success";
    public static final String OUTCOME_VALIDATION_ERROR = "validation_error";
    public static final String OUTCOME_DENIED = "denied";
    public static final String OUTCOME_ERROR = "error";

    public static final String DECISION_ALLOW = "allow";
    public static final String DECISION_DENY = "deny";

    /** Unix epoch milliseconds; assigned by {@link AiAuditLog#record} when omitted. */
    public long timestamp;

    public String endpoint;
    public String user;
    /** Authenticated identity subject, when available. */
    public String sub;

    public String outcome;
    public String policyDecision;
    public String policy;
    public Long latencyMs;
    /** A short safe code, never an exception message or request body. */
    public String error;

    public String cube;
    public String schemaFingerprint;
    public String upstream;
    public String model;
    public Integer promptTokens;
    public Integer responseTokens;
}
