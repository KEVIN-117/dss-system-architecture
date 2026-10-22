package uatf.dss.authservice.application.port.out;

import uatf.dss.authservice.domain.model.AcademicFaculty;
import uatf.dss.authservice.domain.model.AcademicProgram;

import java.util.List;

public interface AcademicCatalogRepository {
    boolean existsActiveFaculty(Integer facultyId);
    boolean existsActiveProgram(String careerId, Integer facultyId);
    List<AcademicFaculty> findActiveFaculties();
    List<AcademicProgram> findActivePrograms();
}
