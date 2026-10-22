package uatf.dss.authservice.adapter.in.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uatf.dss.authservice.application.port.in.AcademicCatalog;
import uatf.dss.authservice.application.port.in.ListAcademicCatalogUseCase;

@RestController
@RequestMapping("/admin/academic-catalog")
@Tag(name = "Administración")
@SecurityRequirement(name = "bearerAuth")
public class AcademicCatalogController {
    private final ListAcademicCatalogUseCase listAcademicCatalog;

    public AcademicCatalogController(ListAcademicCatalogUseCase listAcademicCatalog) {
        this.listAcademicCatalog = listAcademicCatalog;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_SUPERADMIN')")
    @Operation(summary = "Listar facultades y carreras activas", description = "Catálogo académico local para asignar contextos. Requiere SUPERADMIN.")
    public ResponseEntity<AcademicCatalog> getCatalog() {
        return ResponseEntity.ok(listAcademicCatalog.execute());
    }
}
