package chronos.dw.admin.domain.exception;

public class AcademicClosureNotFoundException extends RuntimeException {

    public AcademicClosureNotFoundException(long closureId) {
        super("Academic closure not found: " + closureId);
    }
}
