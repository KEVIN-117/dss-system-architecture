package chronos.dw.admin.adapter.out.hop;

import chronos.dw.admin.domain.exception.HopRequestRejectedException;
import chronos.dw.admin.domain.exception.HopUnavailableException;
import chronos.dw.admin.domain.model.HopRunStatus;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.DefaultHandler;

/** Parsing of Hop Server responses. XML is parsed with DTDs and external entities disabled. */
final class HopResponses {

    /** Hop answers an unknown execution with HTTP 200 and an HTML page. */
    private static final Pattern NOT_FOUND = Pattern.compile("could not be found", Pattern.CASE_INSENSITIVE);

    private static final Pattern STATUS_DESCRIPTION = Pattern.compile("\"statusDescription\"\\s*:\\s*\"([^\"]*)\"");
    private static final int MAX_DECODED_LOG_BYTES = 8 * 1024 * 1024;

    private HopResponses() {}

    /** Parses a {@code <webresult>} and returns its id; throws when Hop reports an error. */
    static UUID webResultId(String body, String operation) {
        Element root = parse(body, operation);
        if (!"webresult".equals(root.getTagName())) {
            throw new HopUnavailableException("Hop Server returned an unexpected " + operation + " response");
        }
        String result = childText(root, "result");
        if (!"OK".equalsIgnoreCase(result)) {
            throw new HopRequestRejectedException(
                    "Hop Server rejected " + operation + ": " + abbreviate(childText(root, "message")));
        }
        String id = childText(root, "id");
        if (id == null || id.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(id.trim());
        } catch (IllegalArgumentException exception) {
            throw new HopUnavailableException("Hop Server returned an invalid execution id for " + operation);
        }
    }

    static String serverStatus(String json) {
        Matcher matcher = STATUS_DESCRIPTION.matcher(json == null ? "" : json);
        if (!matcher.find()) {
            throw new HopUnavailableException("Hop Server returned an unexpected status response");
        }
        return matcher.group(1);
    }

    static HopRunStatus workflowStatus(String body) {
        if (body == null
                || body.isBlank()
                || (!body.contains("<workflow-status")
                        && NOT_FOUND.matcher(body).find())) {
            return HopRunStatus.notFound();
        }
        Element root = parse(body, "workflowStatus");
        if (!"workflow-status".equals(root.getTagName())) {
            throw new HopUnavailableException("Hop Server returned an unexpected workflowStatus response");
        }
        String description = childText(root, "status_desc");
        String error = childText(root, "error_desc");
        long errors = topLevelErrors(root);
        return new HopRunStatus(
                state(description, errors),
                description,
                blankToNull(error),
                decodeLog(childText(root, "logging_string")));
    }

    static HopRunStatus.State state(String description, long errors) {
        String normalized = description == null ? "" : description.trim().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("finished")) {
            return normalized.contains("error") || errors > 0
                    ? HopRunStatus.State.FAILED
                    : HopRunStatus.State.SUCCEEDED;
        }
        if (normalized.startsWith("stopped")) {
            return HopRunStatus.State.STOPPED;
        }
        if (normalized.startsWith("halted")) {
            return HopRunStatus.State.FAILED;
        }
        if (normalized.startsWith("running")
                || normalized.startsWith("paused")
                || normalized.startsWith("stopping")
                || normalized.startsWith("halting")) {
            return HopRunStatus.State.RUNNING;
        }
        return HopRunStatus.State.WAITING;
    }

    /** Hop ships the log as {@code <![CDATA[base64(gzip(text))]]>} escaped inside the element. */
    static String decodeLog(String encoded) {
        if (encoded == null) {
            return "";
        }
        String value = encoded.trim();
        if (value.startsWith("<![CDATA[") && value.endsWith("]]>")) {
            value = value.substring("<![CDATA[".length(), value.length() - "]]>".length())
                    .trim();
        }
        if (value.isEmpty()) {
            return "";
        }
        try (InputStream gzip = new GZIPInputStream(
                new ByteArrayInputStream(Base64.getMimeDecoder().decode(value)))) {
            byte[] bytes = gzip.readNBytes(MAX_DECODED_LOG_BYTES);
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (IOException | IllegalArgumentException exception) {
            return "";
        }
    }

    private static long topLevelErrors(Element root) {
        Element result = childElement(root, "result");
        if (result == null) {
            return 0;
        }
        String errors = childText(result, "nr_errors");
        try {
            return errors == null ? 0 : Long.parseLong(errors.trim());
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private static Element parse(String body, String operation) {
        if (body == null || body.isBlank()) {
            throw new HopUnavailableException("Hop Server returned an empty " + operation + " response");
        }
        try {
            DocumentBuilder builder = secureFactory().newDocumentBuilder();
            // Silent handler: warnings are ignored and fatal errors still throw.
            builder.setErrorHandler(new DefaultHandler());
            Document document = builder.parse(new InputSource(new StringReader(body.strip())));
            return document.getDocumentElement();
        } catch (ParserConfigurationException | SAXException | IOException exception) {
            throw new HopUnavailableException("Hop Server returned a malformed " + operation + " response");
        }
    }

    private static DocumentBuilderFactory secureFactory() throws ParserConfigurationException {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        factory.setNamespaceAware(false);
        return factory;
    }

    private static Element childElement(Element parent, String name) {
        for (Node node = parent.getFirstChild(); node != null; node = node.getNextSibling()) {
            if (node instanceof Element element && name.equals(element.getTagName())) {
                return element;
            }
        }
        return null;
    }

    private static String childText(Element parent, String name) {
        Element child = childElement(parent, name);
        return child == null ? null : child.getTextContent();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String abbreviate(String value) {
        if (value == null || value.isBlank()) {
            return "sin detalle";
        }
        String single = value.replaceAll("\\s+", " ").trim();
        return single.length() > 200 ? single.substring(0, 200) + "…" : single;
    }
}
