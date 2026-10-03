package staging

import (
	"bufio"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"database/sql/driver"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var safePathPart = regexp.MustCompile(`^[a-zA-Z0-9_.-]+$`)

// Artifact describes a finalized, immutable part. Its URI is the path visible
// to both Load Manager and the read-only Hop mount.
type Artifact struct {
	URI         string
	SHA256      string
	ByteCount   int64
	RecordCount int64
	Path        string
}

// Archive writes one deterministic JSONL+gzip artifact per page. Temporary
// files are created beside their final names so rename remains atomic.
type Archive struct {
	root string
}

func NewArchive(root string) (*Archive, error) {
	if strings.TrimSpace(root) == "" {
		return nil, errors.New("DW_RAW_ROOT is required")
	}
	absolute, err := filepath.Abs(root)
	if err != nil {
		return nil, errors.New("could not resolve RAW archive root")
	}
	if err := os.MkdirAll(absolute, 0750); err != nil {
		return nil, errors.New("could not create RAW archive root")
	}
	return &Archive{root: absolute}, nil
}

func (a *Archive) Root() string {
	if a == nil {
		return ""
	}
	return a.root
}

func (a *Archive) WritePart(ctx context.Context, contractID, runID string, part int64, columns []string, rows [][]any) (Artifact, error) {
	if a == nil || part < 1 || len(columns) == 0 || !safePathPart.MatchString(contractID) || !safePathPart.MatchString(runID) {
		return Artifact{}, errors.New("invalid archive part identity or schema")
	}
	if err := ctx.Err(); err != nil {
		return Artifact{}, err
	}
	directory := filepath.Join(a.root, "source="+contractID, "run_id="+runID)
	if err := os.MkdirAll(directory, 0750); err != nil {
		return Artifact{}, errors.New("could not create RAW partition directory")
	}
	finalPath := filepath.Join(directory, fmt.Sprintf("part-%06d.jsonl.gz", part))
	if _, err := os.Stat(finalPath); err == nil {
		return Artifact{}, errors.New("RAW part already exists; run_id artifacts are immutable")
	} else if !errors.Is(err, os.ErrNotExist) {
		return Artifact{}, errors.New("could not inspect RAW part destination")
	}
	temporary, err := os.CreateTemp(directory, ".part-*.tmp")
	if err != nil {
		return Artifact{}, errors.New("could not create temporary RAW part")
	}
	temporaryPath := temporary.Name()
	finalized := false
	defer func() {
		if !finalized {
			_ = os.Remove(temporaryPath)
		}
	}()
	if err := temporary.Chmod(0640); err != nil {
		_ = temporary.Close()
		return Artifact{}, errors.New("could not set RAW part permissions")
	}
	hasher := sha256.New()
	counting := &countingWriter{writer: io.MultiWriter(temporary, hasher)}
	buffered := bufio.NewWriterSize(counting, 64*1024)
	gz := gzip.NewWriter(buffered)
	gz.Header.ModTime = time.Time{}
	gz.Header.OS = 255
	gz.Header.Name = ""
	gz.Header.Comment = ""
	for _, row := range rows {
		if err := ctx.Err(); err != nil {
			_ = gz.Close()
			_ = temporary.Close()
			return Artifact{}, err
		}
		if len(row) != len(columns) {
			_ = gz.Close()
			_ = temporary.Close()
			return Artifact{}, errors.New("RAW row column count differs from contract")
		}
		record := make(map[string]any, len(columns))
		for index, name := range columns {
			value := row[index]
			_, hasJSONMarshaler := value.(json.Marshaler)
			if valuer, ok := value.(interface{ Value() (driver.Value, error) }); ok && !hasJSONMarshaler {
				driverValue, err := valuer.Value()
				if err != nil {
					_ = gz.Close()
					_ = temporary.Close()
					return Artifact{}, errors.New("RAW database value cannot be represented as JSON")
				}
				if text, ok := driverValue.(string); ok {
					numeric := json.Number(text)
					if _, err := json.Marshal(numeric); err == nil {
						value = numeric
					} else {
						value = text
					}
				} else {
					value = driverValue
				}
			}
			record[name] = value
		}
		encoded, err := json.Marshal(record)
		if err != nil {
			_ = gz.Close()
			_ = temporary.Close()
			return Artifact{}, errors.New("RAW row cannot be encoded as JSON")
		}
		if _, err := gz.Write(encoded); err != nil {
			_ = gz.Close()
			_ = temporary.Close()
			return Artifact{}, errors.New("could not write compressed RAW row")
		}
		if _, err := gz.Write([]byte{'\n'}); err != nil {
			_ = gz.Close()
			_ = temporary.Close()
			return Artifact{}, errors.New("could not terminate compressed RAW row")
		}
	}
	if err := gz.Close(); err != nil {
		_ = temporary.Close()
		return Artifact{}, errors.New("could not finish gzip RAW part")
	}
	if err := buffered.Flush(); err != nil {
		_ = temporary.Close()
		return Artifact{}, errors.New("could not flush RAW part")
	}
	info, err := temporary.Stat()
	if err != nil {
		_ = temporary.Close()
		return Artifact{}, errors.New("could not inspect completed RAW part")
	}
	byteCount := info.Size()
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return Artifact{}, errors.New("could not sync completed RAW part")
	}
	if err := temporary.Close(); err != nil {
		return Artifact{}, errors.New("could not close completed RAW part")
	}
	if err := os.Rename(temporaryPath, finalPath); err != nil {
		return Artifact{}, errors.New("could not atomically finalize RAW part")
	}
	finalized = true
	if directoryFile, err := os.Open(directory); err == nil {
		_ = directoryFile.Sync()
		_ = directoryFile.Close()
	}
	uri := (&url.URL{Scheme: "file", Path: filepath.ToSlash(finalPath)}).String()
	return Artifact{URI: uri, SHA256: hex.EncodeToString(hasher.Sum(nil)), ByteCount: byteCount, RecordCount: int64(len(rows)), Path: finalPath}, nil
}

type countingWriter struct {
	writer io.Writer
	count  int64
}

func (w *countingWriter) Write(data []byte) (int, error) {
	n, err := w.writer.Write(data)
	w.count += int64(n)
	return n, err
}

// VerifyArtifact checks the compressed bytes before exposing decoded rows.
func VerifyArtifact(ctx context.Context, path, expectedSHA string, expectedBytes, expectedRows int64) error {
	file, err := os.Open(path)
	if err != nil {
		return errors.New("RAW artifact is missing or unreadable")
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || info.Size() != expectedBytes {
		return errors.New("RAW artifact byte count does not match manifest")
	}
	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil || hex.EncodeToString(hasher.Sum(nil)) != expectedSHA {
		return errors.New("RAW artifact checksum does not match manifest")
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return errors.New("could not rewind RAW artifact")
	}
	gz, err := gzip.NewReader(file)
	if err != nil {
		return errors.New("RAW artifact gzip stream is invalid")
	}
	defer gz.Close()
	decoder := json.NewDecoder(gz)
	var count int64
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		var record map[string]json.RawMessage
		err := decoder.Decode(&record)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil || record == nil {
			return errors.New("RAW artifact contains invalid JSONL")
		}
		count++
	}
	if count != expectedRows {
		return errors.New("RAW artifact record count does not match manifest")
	}
	return nil
}
