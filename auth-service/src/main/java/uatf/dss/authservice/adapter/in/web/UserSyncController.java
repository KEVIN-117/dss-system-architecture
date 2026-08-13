package uatf.dss.authservice.adapter.in.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;

@RestController
@RequestMapping("/api/v1/auth")
public class UserSyncController {

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
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody UserSyncRequest request
    ) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String providedSecret = authorizationHeader.substring(7).trim();
        if (!expectedSecret.equals(providedSecret)) {
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
