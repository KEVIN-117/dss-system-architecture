/*
 *   Copyright 2026 Spicule Ltd
 *   Licensed under the Apache License, Version 2.0.
 */
package org.saiku.service.olap.ai.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Append-only JSONL audit store for AI query activity. */
public class AiAuditLog {

    private static final Logger log = LoggerFactory.getLogger(AiAuditLog.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final int MAX_PAGE_SIZE = 1_000;

    private final boolean enabled;
    /** Null in tests/no-home mode; those instances use the in-memory list. */
    private final Path file;

    private final List<AiAuditEntry> memory = new CopyOnWriteArrayList<>();

    public AiAuditLog() {
        this(System.getProperty("ai.audit.enabled", "true"), System.getProperty("ai.audit.file", defaultFilePath()));
    }

    /** Spring constructor; the values come from saiku-beans.properties or system properties. */
    public AiAuditLog(String enabled, String filePath) {
        this.enabled = Boolean.parseBoolean(enabled == null ? "true" : enabled.trim());
        Path configured = null;
        if (filePath != null && !filePath.isBlank()) {
            try {
                configured = Paths.get(filePath).toAbsolutePath().normalize();
            } catch (RuntimeException e) {
                log.error("Invalid AI audit file path; using in-memory audit storage", e);
            }
        }
        this.file = configured;
    }

    /** Constructor for callers that already resolved the audit file path. */
    public AiAuditLog(Path file, boolean enabled) {
        this(Boolean.toString(enabled), file == null ? null : file.toString());
    }

    public boolean isEnabled() {
        return enabled;
    }

    /** Persist an entry without ever allowing a logging failure to break the request. */
    public synchronized void record(AiAuditEntry entry) {
        if (!enabled || entry == null) {
            return;
        }
        if (entry.timestamp <= 0) {
            entry.timestamp = System.currentTimeMillis();
        }
        if (file == null) {
            memory.add(entry);
            return;
        }
        try {
            Path parent = file.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            String line = MAPPER.writeValueAsString(entry) + System.lineSeparator();
            Files.writeString(
                    file,
                    line,
                    StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.WRITE,
                    StandardOpenOption.APPEND);
        } catch (IOException | RuntimeException e) {
            log.error("Could not append AI audit entry to {}", file, e);
        }
    }

    /** Return newest-first entries with bounded pagination and optional user/date filters. */
    public synchronized List<AiAuditEntry> recent(int limit, int offset, String user, String since) {
        int safeLimit = Math.max(0, Math.min(limit, MAX_PAGE_SIZE));
        int safeOffset = Math.max(0, offset);
        long sinceMillis = parseSince(since);
        List<AiAuditEntry> entries = readEntries().stream()
                .filter((entry) -> user == null || user.isBlank() || user.equals(entry.user))
                .filter((entry) -> sinceMillis <= 0 || entry.timestamp >= sinceMillis)
                .sorted(Comparator.comparingLong((AiAuditEntry entry) -> entry.timestamp)
                        .reversed())
                .toList();
        if (safeOffset >= entries.size() || safeLimit == 0) {
            return List.of();
        }
        int end = Math.min(entries.size(), safeOffset + safeLimit);
        return new ArrayList<>(entries.subList(safeOffset, end));
    }

    public synchronized long count() {
        return readEntries().size();
    }

    private List<AiAuditEntry> readEntries() {
        if (file == null) {
            return new ArrayList<>(memory);
        }
        if (!Files.isRegularFile(file)) {
            return List.of();
        }
        List<AiAuditEntry> entries = new ArrayList<>();
        try {
            for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                if (line.isBlank()) {
                    continue;
                }
                try {
                    entries.add(MAPPER.readValue(line, AiAuditEntry.class));
                } catch (IOException e) {
                    log.warn("Skipping malformed AI audit record in {}", file);
                }
            }
        } catch (IOException e) {
            log.error("Could not read AI audit file {}", file, e);
        }
        return entries;
    }

    private static long parseSince(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        try {
            return Instant.parse(value).toEpochMilli();
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDate.parse(value)
                        .atStartOfDay(ZoneOffset.UTC)
                        .toInstant()
                        .toEpochMilli();
            } catch (DateTimeParseException invalid) {
                return Long.MAX_VALUE;
            }
        }
    }

    private static String defaultFilePath() {
        String home = System.getProperty("saiku.home");
        return home == null || home.isBlank()
                ? null
                : Paths.get(home, "logs", "ai-audit.jsonl").toString();
    }
}
