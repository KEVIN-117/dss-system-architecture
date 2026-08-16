package uatf.dss.authservice.adapter.in.web;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/demo")
public class DemoEndpoint {

    @GetMapping("/public")
    public ResponseEntity<String> hello(){
        return ResponseEntity.ok("Welcome to public route");
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<String> helloSuperAdmin(){
        return ResponseEntity.ok("Welcome Superadmin...!");
    }

    @GetMapping("/rector")
    @PreAuthorize("hasRole('RECTOR')")
    public ResponseEntity<String> helloRector(){
        return ResponseEntity.ok("Welcome Rector...!");
    }

    @GetMapping("/decano")
    @PreAuthorize("hasRole('DECANO')")
    public ResponseEntity<String> helloDecano(){
        return ResponseEntity.ok("Welcome Decano...!");
    }

    @GetMapping("/director")
    @PreAuthorize("hasRole('DIRECTOR')")
    public ResponseEntity<String> helloDirector(){
        return ResponseEntity.ok("Welcome Director...!");
    }
}
