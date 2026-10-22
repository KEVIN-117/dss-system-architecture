package uatf.dss.authservice.application.port.in;

import java.util.List;

public record AcademicCatalog(List<Faculty> faculties, List<Career> careers) {
    public AcademicCatalog {
        faculties = List.copyOf(faculties);
        careers = List.copyOf(careers);
    }

    public record Faculty(Integer id, String name) {}

    public record Career(String id, String name, Integer facultyId) {}
}
