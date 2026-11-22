package chronos.dw.admin.application.service;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Sanitizes Hop logs before they are stored with a launch or shown in the portal: strips control characters, masks
 * credentials and keeps only the tail.
 */
public final class EtlLogExcerpts {

    static final int MAX_SUMMARY_LENGTH = 2000;

    private static final Pattern CONTROL = Pattern.compile("[\\p{Cntrl}&&[^\\n\\t]]");
    private static final Pattern SECRET_ASSIGNMENT = Pattern.compile(
            "(?i)\\b(password|passwd|pwd|secret|token|api[_-]?key)(\\s*[=:]\\s*)(\"[^\"]*\"|'[^']*'|\\S+)");
    private static final Pattern URL_CREDENTIALS =
            Pattern.compile("(?i)(\\b[a-z][a-z0-9+.-]*://)[^/\\s:@]+:[^/\\s@]+@");

    private EtlLogExcerpts() {}

    public static String sanitize(String log) {
        if (log == null || log.isEmpty()) {
            return "";
        }
        String normalized = log.replace("\r\n", "\n").replace('\r', '\n');
        String withoutControl = CONTROL.matcher(normalized).replaceAll("");
        String withoutSecrets = SECRET_ASSIGNMENT.matcher(withoutControl).replaceAll("$1$2***");
        return URL_CREDENTIALS.matcher(withoutSecrets).replaceAll("$1***@");
    }

    /** Sanitized tail of the log, cut at a line boundary, at most {@code maxChars} characters. */
    public static String tail(String log, int maxChars) {
        String sanitized = sanitize(log);
        if (sanitized.length() <= maxChars) {
            return sanitized.isBlank() ? null : sanitized;
        }
        String tail = sanitized.substring(sanitized.length() - maxChars);
        int firstLineBreak = tail.indexOf('\n');
        return firstLineBreak >= 0 && firstLineBreak < tail.length() - 1 ? tail.substring(firstLineBreak + 1) : tail;
    }

    /** Last {@code ERROR} line of the log, sanitized, or {@code fallback} when there is none. */
    public static String failureSummary(String errorDescription, String log, String fallback) {
        if (errorDescription != null && !errorDescription.isBlank()) {
            return limit(sanitize(errorDescription).trim());
        }
        List<String> errorLines = sanitize(log)
                .lines()
                .filter(line -> line.contains("ERROR") && !line.strip().endsWith("ERROR:"))
                .toList();
        if (errorLines.isEmpty()) {
            return fallback;
        }
        return limit(summarizeErrorLine(errorLines.get(errorLines.size() - 1)));
    }

    /** Hop lines look like {@code <date> - <component> - ERROR: <message>}; keeps {@code <component>: <message>}. */
    private static String summarizeErrorLine(String line) {
        int errorIndex = line.indexOf("ERROR");
        String message = line.substring(errorIndex + "ERROR".length())
                .replaceFirst("^\\s*:?\\s*", "")
                .trim();
        String prefix = line.substring(0, errorIndex).trim();
        if (prefix.endsWith("-")) {
            prefix = prefix.substring(0, prefix.length() - 1).trim();
        }
        int componentStart = prefix.lastIndexOf(" - ");
        String component =
                componentStart >= 0 ? prefix.substring(componentStart + 3).trim() : "";
        if (message.isEmpty()) {
            return line.trim();
        }
        return component.isEmpty() ? message : component + ": " + message;
    }

    static String limit(String value) {
        return value.length() > MAX_SUMMARY_LENGTH ? value.substring(0, MAX_SUMMARY_LENGTH - 1) + "…" : value;
    }
}
