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


    private final SyncUserUseCase useCase;

    public UserSyncController(SyncUserUseCase useCase) {
        this.useCase = useCase;
    }

    @PostMapping("/sync")
    public ResponseEntity<Void> sync(@RequestBody UserSyncRequest request) {

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
