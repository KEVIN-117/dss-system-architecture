/*
 *   Copyright 2026 Spicule Ltd
 *   Licensed under the Apache License, Version 2.0.
 */
package org.saiku.web.security.audit;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Emits structured authentication audit events without logging credentials or tokens. */
public final class AuditLogger {

    private static final Logger audit = LoggerFactory.getLogger("org.saiku.audit");

    private AuditLogger() {}

    public static void loginSuccess(HttpServletRequest request, String username) {
        audit.info("event=login outcome=success user={} ip={}", safe(username), clientIp(request));
    }

    public static void loginFailure(HttpServletRequest request, String username, String reason) {
        audit.info(
                "event=login outcome=failure user={} ip={} reason={}", safe(username), clientIp(request), safe(reason));
    }

    public static void rateLimitTriggered(HttpServletRequest request, String username) {
        audit.warn("event=login outcome=rate_limited user={} ip={}", safe(username), clientIp(request));
    }

    public static void logout(HttpServletRequest request, String username) {
        audit.info("event=logout outcome=success user={} ip={}", safe(username), clientIp(request));
    }

    private static String clientIp(HttpServletRequest request) {
        return request == null ? "unknown" : safe(request.getRemoteAddr());
    }

    private static String safe(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        StringBuilder sanitized = new StringBuilder(Math.min(value.length(), 128));
        for (int i = 0; i < value.length() && sanitized.length() < 128; i++) {
            char ch = value.charAt(i);
            sanitized.append(Character.isISOControl(ch) || ch == ' ' ? '_' : ch);
        }
        return sanitized.toString();
    }
}
