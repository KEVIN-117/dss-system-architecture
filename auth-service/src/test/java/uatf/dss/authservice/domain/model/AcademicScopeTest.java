package uatf.dss.authservice.domain.model;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AcademicScopeTest {

    @Test
    void globalBeatsFacultyAndCareer() {
        assertEquals(AcademicScope.GLOBAL,
                AcademicScope.fromPermissions(List.of("analytics:career", "analytics:faculty", "analytics:global")));
    }

    @Test
    void facultyBeatsCareer() {
        assertEquals(AcademicScope.FACULTY,
                AcademicScope.fromPermissions(List.of("analytics:career", "analytics:faculty")));
    }

    @Test
    void careerAloneIsCareer() {
        assertEquals(AcademicScope.CAREER, AcademicScope.fromPermissions(Set.of("analytics:career", "reports:read")));
    }

    @Test
    void noAnalyticsPermissionIsNone() {
        assertEquals(AcademicScope.NONE, AcademicScope.fromPermissions(List.of("reports:read")));
        assertEquals(AcademicScope.NONE, AcademicScope.fromPermissions(List.of()));
        assertEquals(AcademicScope.NONE, AcademicScope.fromPermissions(null));
    }
}
