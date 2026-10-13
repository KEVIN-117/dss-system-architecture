package uatf.dss.authservice.adapter.in.web;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/demo")
@Tag(name = "Demostración")
public class DemoEndpoint {

    @GetMapping("/public")
    @Operation(summary = "Probar una ruta pública")
    public ResponseEntity<String> hello(){
        return ResponseEntity.ok("Welcome to public route");
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('SUPERADMIN')")
    @Operation(summary = "Probar acceso de superadministrador")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<String> helloSuperAdmin(){
        return ResponseEntity.ok("Welcome Superadmin...!");
    }

    @GetMapping("/rector")
    @PreAuthorize("hasRole('RECTOR')")
    @Operation(summary = "Probar acceso de rector")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<String> helloRector(){
        return ResponseEntity.ok("Welcome Rector...!");
    }

    @GetMapping("/decano")
    @PreAuthorize("hasRole('DECANO')")
    @Operation(summary = "Probar acceso de decano")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<String> helloDecano(){
        return ResponseEntity.ok("Welcome Decano...!");
    }

    @GetMapping("/director")
    @PreAuthorize("hasRole('DIRECTOR')")
    @Operation(summary = "Probar acceso de director")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<String> helloDirector(){
        return ResponseEntity.ok("Welcome Director...!");
    }
}
