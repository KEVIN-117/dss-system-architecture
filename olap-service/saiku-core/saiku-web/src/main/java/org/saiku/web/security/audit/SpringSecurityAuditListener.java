/*
 *   Copyright 2026 Spicule Ltd
 *   Licensed under the Apache License, Version 2.0.
 */
package org.saiku.web.security.audit;

import jakarta.servlet.http.HttpServletRequest;
import org.saiku.web.security.ratelimit.LoginRateLimiter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationListener;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.Authentication;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Records Spring Security authentication outcomes and updates the login limiter. */
public class SpringSecurityAuditListener implements ApplicationListener<org.springframework.context.ApplicationEvent> {

    private static final Logger audit = LoggerFactory.getLogger("org.saiku.audit");
    private LoginRateLimiter rateLimiter;

    public void setRateLimiter(LoginRateLimiter rateLimiter) {
        this.rateLimiter = rateLimiter;
    }

    @Override
    public void onApplicationEvent(org.springframework.context.ApplicationEvent event) {
        if (event instanceof AuthenticationSuccessEvent success) {
            HttpServletRequest request = currentRequest();
            if (request != null && rateLimiter != null) {
                rateLimiter.recordSuccess(request);
            }
            audit.info("event=authentication outcome=success user={}", safeName(success.getAuthentication()));
        } else if (event instanceof AbstractAuthenticationFailureEvent failure) {
            HttpServletRequest request = currentRequest();
            if (request != null && rateLimiter != null) {
                rateLimiter.recordFailure(request);
            }
            audit.info(
                    "event=authentication outcome=failure user={} reason={}",
                    safeName(failure.getAuthentication()),
                    failure.getException().getClass().getSimpleName());
        }
    }

    private static HttpServletRequest currentRequest() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        return attributes instanceof ServletRequestAttributes servletAttributes ? servletAttributes.getRequest() : null;
    }

    private static String safeName(Authentication authentication) {
        if (authentication == null
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            return "unknown";
        }
        return authentication.getName().replaceAll("[\\p{Cntrl}\\s]", "_");
    }
}
