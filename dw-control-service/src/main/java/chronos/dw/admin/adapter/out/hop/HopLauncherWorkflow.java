package chronos.dw.admin.adapter.out.hop;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Pattern;
import java.util.zip.GZIPOutputStream;

/**
 * Builds the registerWorkflow body of the Load Manager launcher (docs/dw/hop-server-contract.md): a minimal workflow
 * whose single WORKFLOW action runs {@code ${P_TARGET_WORKFLOW}} from the server's own project, passing every declared
 * parameter down. The service never ships project files; Hop Server resolves connections from its project metadata.
 */
final class HopLauncherWorkflow {

    static final String NAME = "dss_lm_launcher";
    static final String TARGET_PARAMETER = "P_TARGET_WORKFLOW";

    private static final Pattern WORKFLOW_FILE = Pattern.compile("^workflows/[a-z0-9_]+\\.hwf$");
    private static final Pattern PARAMETER_NAME = Pattern.compile("^P_[A-Z0-9_]{1,60}$");
    private static final int MAX_VALUE_LENGTH = 255;
    private static final String EMPTY_METASTORE = gzipBase64("{}");

    private HopLauncherWorkflow() {}

    static String build(String projectHome, String workflowFile, Map<String, String> parameters) {
        if (workflowFile == null || !WORKFLOW_FILE.matcher(workflowFile).matches()) {
            throw new IllegalArgumentException("Invalid project workflow file");
        }
        Map<String, String> values = new TreeMap<>();
        values.put(TARGET_PARAMETER, stripTrailingSlash(projectHome) + "/" + workflowFile);
        if (parameters != null) {
            parameters.forEach((name, value) -> {
                if (name == null || !PARAMETER_NAME.matcher(name).matches() || TARGET_PARAMETER.equals(name)) {
                    throw new IllegalArgumentException("Invalid Hop parameter name: " + name);
                }
                if (value == null || value.length() > MAX_VALUE_LENGTH || hasControlCharacters(value)) {
                    throw new IllegalArgumentException("Invalid value for Hop parameter " + name);
                }
                values.put(name, value);
            });
        }

        StringBuilder declared = new StringBuilder();
        StringBuilder assigned = new StringBuilder();
        values.forEach((name, value) -> {
            declared.append("<parameter><name>")
                    .append(name)
                    .append("</name><default_value/><description/></parameter>");
            assigned.append("<parameter><name>")
                    .append(name)
                    .append("</name><value>")
                    .append(escape(value))
                    .append("</value></parameter>");
        });

        return """
                <workflow_configuration>
                <workflow>
                  <name>%s</name><name_sync_with_filename>N</name_sync_with_filename>
                  <description>DSS Load Manager launcher</description>
                  <parameters>%s</parameters>
                  <actions>
                    <action><name>Start</name><description/><type>SPECIAL</type><attributes/><repeat>N</repeat><schedulerType>0</schedulerType><parallel>N</parallel><xloc>0</xloc><yloc>0</yloc><attributes_hac/></action>
                    <action><name>Run target workflow</name><description/><type>WORKFLOW</type><attributes/><run_configuration>local</run_configuration><filename>${%s}</filename><params_from_previous>N</params_from_previous><exec_per_row>N</exec_per_row><set_logfile>N</set_logfile><loglevel>Basic</loglevel><wait_until_finished>Y</wait_until_finished><create_parent_folder>N</create_parent_folder><parameters><pass_all_parameters>Y</pass_all_parameters></parameters><parallel>N</parallel><xloc>160</xloc><yloc>0</yloc><attributes_hac/></action>
                  </actions>
                  <hops><hop><from>Start</from><to>Run target workflow</to><enabled>Y</enabled><evaluation>Y</evaluation><unconditional>Y</unconditional></hop></hops>
                  <notepads/><attributes/>
                </workflow>
                <workflow_execution_configuration>
                  <log_level>Basic</log_level>
                  <run_configuration>local</run_configuration>
                  <parameters>%s</parameters>
                </workflow_execution_configuration>
                <metastore_json>%s</metastore_json>
                </workflow_configuration>
                """
                .formatted(NAME, declared, TARGET_PARAMETER, assigned, EMPTY_METASTORE);
    }

    private static String stripTrailingSlash(String value) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }

    private static boolean hasControlCharacters(String value) {
        return value.chars().anyMatch(Character::isISOControl);
    }

    private static String escape(String value) {
        StringBuilder escaped = new StringBuilder(value.length());
        for (char character : value.toCharArray()) {
            switch (character) {
                case '&' -> escaped.append("&amp;");
                case '<' -> escaped.append("&lt;");
                case '>' -> escaped.append("&gt;");
                case '"' -> escaped.append("&quot;");
                case '\'' -> escaped.append("&apos;");
                default -> escaped.append(character);
            }
        }
        return escaped.toString();
    }

    private static String gzipBase64(String value) {
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (GZIPOutputStream gzip = new GZIPOutputStream(bytes)) {
                gzip.write(value.getBytes(StandardCharsets.UTF_8));
            }
            return Base64.getEncoder().encodeToString(bytes.toByteArray());
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }
}
