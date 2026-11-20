package uatf.dss.authservice.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import uatf.dss.authservice.domain.model.audit.AuditActor;
import uatf.dss.authservice.shared.ClientIpResolver;

/** Builds the audit actor of an administrative request from its JWT and its client IP. */
final class AuditActors {

    private AuditActors() {
    }

    static AuditActor from(JwtAuthenticationToken authentication, HttpServletRequest request) {
        Jwt token = authentication.getToken();
        String username = token.getClaimAsString("preferred_username");
        return new AuditActor(token.getSubject(), username != null ? username : authentication.getName(),
                ClientIpResolver.resolve(request));
    }
}
