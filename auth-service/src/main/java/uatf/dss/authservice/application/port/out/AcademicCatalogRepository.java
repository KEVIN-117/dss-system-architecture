package uatf.dss.authservice.application.port.out;

public interface AcademicCatalogRepository {
    boolean existsActiveFaculty(Integer facultyId);
    boolean existsActiveProgram(String careerId, Integer facultyId);
}
