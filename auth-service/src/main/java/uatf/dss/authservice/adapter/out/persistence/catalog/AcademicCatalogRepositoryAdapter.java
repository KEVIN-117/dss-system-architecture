package uatf.dss.authservice.adapter.out.persistence.catalog;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import uatf.dss.authservice.application.port.out.AcademicCatalogRepository;
import uatf.dss.authservice.domain.model.AcademicFaculty;
import uatf.dss.authservice.domain.model.AcademicProgram;

import java.util.List;

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

    @Override
    public List<AcademicFaculty> findActiveFaculties() {
        return jdbcTemplate.query(
                "SELECT faculty_id, name FROM academic_faculties " +
                        "WHERE is_active = TRUE ORDER BY name, faculty_id",
                (resultSet, rowNumber) -> new AcademicFaculty(
                        resultSet.getInt("faculty_id"), resultSet.getString("name")));
    }

    @Override
    public List<AcademicProgram> findActivePrograms() {
        return jdbcTemplate.query(
                "SELECT program.career_id, program.name, program.faculty_id " +
                        "FROM academic_programs program " +
                        "INNER JOIN academic_faculties faculty ON faculty.faculty_id = program.faculty_id " +
                        "WHERE program.is_active = TRUE AND faculty.is_active = TRUE " +
                        "ORDER BY program.name, program.career_id",
                (resultSet, rowNumber) -> new AcademicProgram(
                        resultSet.getString("career_id").trim(),
                        resultSet.getString("name"),
                        resultSet.getInt("faculty_id")));
    }
}
