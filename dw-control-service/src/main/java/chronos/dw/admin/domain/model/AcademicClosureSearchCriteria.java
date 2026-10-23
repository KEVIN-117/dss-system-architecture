package chronos.dw.admin.domain.model;

/** Optional filters accepted when listing academic period closures. */
public record AcademicClosureSearchCriteria(Integer gestion, Integer periodo, ClosureStatus status) {

    public AcademicClosureSearchCriteria {
        if (gestion != null && gestion < 2000) {
            throw new IllegalArgumentException("Gestion must be 2000 or later");
        }
        if (periodo != null && periodo <= 0) {
            throw new IllegalArgumentException("Periodo must be positive");
        }
    }
}
