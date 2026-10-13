package uatf.dss.authservice.adapter.out.persistence.catalog;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import uatf.dss.authservice.application.port.out.AcademicCatalogRepository;

@Repository
public class AcademicCatalogRepositoryAdapter implements AcademicCatalogRepository {

    private final JdbcTemplate jdbcTemplate;

    public AcademicCatalogRepositoryAdapter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public boolean existsActiveFaculty(Integer facultyId) {
        Boolean exists = jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM academic_faculties WHERE faculty_id = ? AND is_active)",
                Boolean.class,
                facultyId);
        return Boolean.TRUE.equals(exists);
    }

    @Override
    public boolean existsActiveProgram(String careerId, Integer facultyId) {
        Boolean exists = jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM academic_programs " +
                        "WHERE career_id = ? AND faculty_id = ? AND is_active)",
                Boolean.class,
                careerId,
                facultyId);
        return Boolean.TRUE.equals(exists);
    }
}
