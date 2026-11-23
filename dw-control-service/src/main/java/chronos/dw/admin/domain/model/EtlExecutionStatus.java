package chronos.dw.admin.domain.model;

public enum EtlExecutionStatus {
    SOLICITADA,
    EN_EJECUCION,
    PUBLICANDO,
    EXITOSA,
    FALLIDA,
    CANCELADA;

    /** EXITOSA, FALLIDA or CANCELADA: the attempt finished and can be the parent of a reprocess. */
    public boolean isTerminal() {
        return this == EXITOSA || this == FALLIDA || this == CANCELADA;
    }
}
