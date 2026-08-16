package uatf.dss.authservice.adapter.in.web;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uatf.dss.authservice.application.port.in.AuthUserProfile;
import uatf.dss.authservice.application.port.in.GetAuthUserProfileCommand;
import uatf.dss.authservice.application.port.in.GetAuthUserProfileUseCase;

import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
public class UserProfileController {

    private final GetAuthUserProfileUseCase authUserProfileUseCase;

    public UserProfileController(GetAuthUserProfileUseCase authUserProfileUseCase){
        this.authUserProfileUseCase = authUserProfileUseCase;
    }

    @GetMapping("/me")
    public ResponseEntity<AuthUserProfile> getAuthenticatedUserProfile(@AuthenticationPrincipal Jwt jwt){
        UUID keycloakId = UUID.fromString(Objects.requireNonNull(jwt.getSubject()));
        GetAuthUserProfileCommand keycloak = new GetAuthUserProfileCommand(keycloakId);
        AuthUserProfile userProfile = authUserProfileUseCase.execute(keycloak);
        return ResponseEntity.ok(userProfile);
    }
}
