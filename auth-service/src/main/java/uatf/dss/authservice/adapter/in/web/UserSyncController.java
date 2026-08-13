package uatf.dss.authservice.adapter.in.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;

import java.util.Objects;

@RestController
@RequestMapping("/auth")
public class UserSyncController {

    private static final Logger log = LoggerFactory.getLogger(UserSyncController.class);

    private final SyncUserUseCase useCase;
    private final String expectedSecret;

    public UserSyncController(
            SyncUserUseCase useCase,
            @Value("${app.security.webhook-secret:dss-webhook-secret-xyz123}") String expectedSecret
    ) {
        this.useCase = useCase;
        this.expectedSecret = expectedSecret;
    }

    @PostMapping("/sync")
    public ResponseEntity<Void> sync(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String providedSecret,
            @RequestBody UserSyncRequest request
    ) {
        log.info("Incoming sync request. X-Webhook-Secret: {}, expectedSecret length: {}",
                providedSecret != null ? "PRESENT" : "NULL",
                expectedSecret != null ? expectedSecret.length() : 0);

        if (providedSecret == null || providedSecret.trim().isEmpty()) {
            log.warn("Unauthorized sync request: missing X-Webhook-Secret header");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        if (!Objects.equals(expectedSecret, providedSecret.trim())) {
            log.warn("Unauthorized sync request: secret mismatch. Provided secret: '{}', Expected secret: '{}'",
                    providedSecret, expectedSecret);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        if (request.user() == null || request.user().keycloakId() == null) {
            return ResponseEntity.badRequest().build();
        }

        SyncUserCommand command = new SyncUserCommand(
                request.user().keycloakId(),
                request.user().username(),
                request.user().email(),
                request.user().firstName(),
                request.user().lastName(),
                request.user().isActive()
        );

        useCase.sync(command);
        return ResponseEntity.ok().build();
    }
}
