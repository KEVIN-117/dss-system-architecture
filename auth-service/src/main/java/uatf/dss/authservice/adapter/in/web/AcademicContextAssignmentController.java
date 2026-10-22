package uatf.dss.authservice.adapter.in.web;

import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsCommand;
import uatf.dss.authservice.application.port.in.SetUserAcademicContextsUseCase;
import uatf.dss.authservice.domain.model.UserAcademicContext;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/admin/users")
@Tag(name = "Administración")
@SecurityRequirement(name = "bearerAuth")
public class AcademicContextAssignmentController {

    private final SetUserAcademicContextsUseCase useCase;

    public AcademicContextAssignmentController(SetUserAcademicContextsUseCase useCase) {
        this.useCase = useCase;
    }

    @PutMapping("/{userId}/academic-contexts")
    @Operation(summary = "Reemplazar el contexto académico de un usuario")
    @PreAuthorize("hasAuthority('ROLE_SUPERADMIN')")
    public ResponseEntity<List<UserAcademicContext>> replaceAcademicContexts(
            @PathVariable UUID userId,
            @Valid @RequestBody AcademicContextAssignmentRequest request,
            JwtAuthenticationToken authentication) {
        UUID actorKeycloakId = UUID.fromString(Objects.requireNonNull(authentication.getToken().getSubject()));
        List<SetUserAcademicContextsCommand.AcademicContextInput> contexts = request.contexts().stream()
                .map(context -> new SetUserAcademicContextsCommand.AcademicContextInput(
                        context.facultyId(), context.careerId()))
                .toList();

        List<UserAcademicContext> saved = useCase.execute(
                new SetUserAcademicContextsCommand(actorKeycloakId, userId, contexts));
        return ResponseEntity.ok(saved);
    }
}
