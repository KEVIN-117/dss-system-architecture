package uatf.dss.authservice.application.service;

import uatf.dss.authservice.application.port.in.AcademicCatalog;
import uatf.dss.authservice.application.port.in.ListAcademicCatalogUseCase;
import uatf.dss.authservice.application.port.out.AcademicCatalogRepository;

public class ListAcademicCatalogService implements ListAcademicCatalogUseCase {
    private final AcademicCatalogRepository catalogRepository;

    public ListAcademicCatalogService(AcademicCatalogRepository catalogRepository) {
        this.catalogRepository = catalogRepository;
    }

    @Override
    public AcademicCatalog execute() {
        var faculties = catalogRepository.findActiveFaculties().stream()
                .map(faculty -> new AcademicCatalog.Faculty(faculty.id(), faculty.name()))
                .toList();
        var careers = catalogRepository.findActivePrograms().stream()
                .map(program -> new AcademicCatalog.Career(program.id(), program.name(), program.facultyId()))
                .toList();
        return new AcademicCatalog(faculties, careers);
    }
}
