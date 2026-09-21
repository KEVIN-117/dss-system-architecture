package uatf.dss.authservice.adapter.in.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import uatf.dss.authservice.application.port.in.SyncUserCommand;
import uatf.dss.authservice.application.port.in.SyncUserUseCase;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/auth")
public class UserSyncController {

    private final SyncUserUseCase useCase;

    public UserSyncController(SyncUserUseCase useCase) {
        this.useCase = useCase;
    }

    @PostMapping("/sync")
    public ResponseEntity<Void> sync(@Valid @RequestBody UserSyncRequest request) {

        SyncUserCommand command = new SyncUserCommand(
                request.user().keycloakId(),
                request.user().username(),
                request.user().email(),
                request.user().firstName(),
                request.user().lastName(),
                request.user().isActive());

        useCase.sync(command);
        return ResponseEntity.ok().build();
    }
}
