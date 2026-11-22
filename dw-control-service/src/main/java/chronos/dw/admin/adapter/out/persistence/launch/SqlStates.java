package chronos.dw.admin.adapter.out.persistence.launch;

import java.sql.SQLException;

/** SQLSTATE helpers for the Load Manager command functions (error codes in migration 0065). */
final class SqlStates {

    private SqlStates() {}

    static String of(Throwable exception) {
        Throwable current = exception;
        while (current != null) {
            if (current instanceof SQLException sqlException) {
                return sqlException.getSQLState();
            }
            current = current.getCause();
        }
        return null;
    }

    /** First line of the database message, without the PostgreSQL "ERROR:" prefix. */
    static String message(Throwable exception) {
        Throwable current = exception;
        while (current != null) {
            if (current instanceof SQLException sqlException && sqlException.getMessage() != null) {
                String message =
                        sqlException.getMessage().lines().findFirst().orElse("").trim();
                return message.startsWith("ERROR:")
                        ? message.substring("ERROR:".length()).trim()
                        : message;
            }
            current = current.getCause();
        }
        return "La operación no es compatible con el estado actual";
    }
}
