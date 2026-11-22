package chronos.dw.admin.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class EtlLogExcerptsTest {

    @Test
    void masksCredentialsAndControlCharacters() {
        String log = "url jdbc:postgresql://hop:clave@db:5432/dw\u0007 PASSWORD = \"x y\" token:abc\n";

        String sanitized = EtlLogExcerpts.sanitize(log);

        assertEquals("url jdbc:postgresql://***@db:5432/dw PASSWORD = *** token:***\n", sanitized);
    }

    @Test
    void keepsTheTailFromALineBoundary() {
        String log = "primera línea\nsegunda línea\ntercera línea";

        String tail = EtlLogExcerpts.tail(log, 20);

        assertEquals("tercera línea", tail);
        assertTrue(tail.length() <= 20);
        assertNull(EtlLogExcerpts.tail("   ", 20));
    }

    @Test
    void summarizesHopErrorOrFallsBack() {
        assertEquals("Conexión rechazada", EtlLogExcerpts.failureSummary("Conexión rechazada", "", "fallback"));
        assertEquals(
                "B: fallo B",
                EtlLogExcerpts.failureSummary(
                        null, "2026 - A - ERROR: fallo A\n2026 - B - ERROR: fallo B\n2026 - C - ok", "fallback"));
        assertEquals("fallback", EtlLogExcerpts.failureSummary(null, "todo bien", "fallback"));
        assertFalse(EtlLogExcerpts.failureSummary(null, "x - ERROR: " + "z".repeat(3000), "f")
                        .length()
                > 2000);
    }
}
