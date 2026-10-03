package staging

import (
	"bytes"
	"compress/gzip"
	"context"
	"io"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestArchiveWritesDeterministicJSONLGzipPartsAndVerifies(t *testing.T) {
	root := t.TempDir()
	archive, err := NewArchive(root)
	if err != nil {
		t.Fatal(err)
	}
	columns := []string{"id", "description", "optional"}
	rows := [][]any{{int32(7), "café, \"campus\"\ncentral", nil}, {int32(8), "plain", "value"}}
	first, err := archive.WritePart(context.Background(), "public.uatf_datos", "run-a", 1, columns, rows)
	if err != nil {
		t.Fatal(err)
	}
	second, err := archive.WritePart(context.Background(), "public.uatf_datos", "run-b", 1, columns, rows)
	if err != nil {
		t.Fatal(err)
	}
	if first.SHA256 != second.SHA256 || first.ByteCount != second.ByteCount {
		t.Fatalf("gzip representation is not deterministic: first=%+v second=%+v", first, second)
	}
	if first.RecordCount != int64(len(rows)) || filepath.Ext(first.Path) != ".gz" {
		t.Fatalf("unexpected artifact metadata: %+v", first)
	}
	if err := VerifyArtifact(context.Background(), first.Path, first.SHA256, first.ByteCount, first.RecordCount); err != nil {
		t.Fatalf("verify newly written artifact: %v", err)
	}
	if _, err := archive.WritePart(context.Background(), "public.uatf_datos", "run-a", 1, columns, rows); err == nil {
		t.Fatal("existing finalized part was overwritten")
	}
}

func TestArchiveEncodesPostgresNumericAsJSONNumber(t *testing.T) {
	archive, err := NewArchive(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	numeric := pgtype.Numeric{Int: big.NewInt(755), Exp: -1, Valid: true}
	artifact, err := archive.WritePart(context.Background(), "academico.notas_planilla", "run-numeric", 1,
		[]string{"nota", "observacion"}, [][]any{{numeric, "café"}})
	if err != nil {
		t.Fatal(err)
	}
	file, err := os.Open(artifact.Path)
	if err != nil {
		t.Fatal(err)
	}
	reader, err := gzip.NewReader(file)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := io.ReadAll(reader)
	_ = reader.Close()
	_ = file.Close()
	if err != nil || !bytes.Contains(decoded, []byte(`"nota":75.5`)) || !bytes.Contains(decoded, []byte(`"observacion":"café"`)) {
		t.Fatalf("JSONL did not preserve numeric or UTF-8 values: %s (err=%v)", strings.TrimSpace(string(decoded)), err)
	}
	if err := VerifyArtifact(context.Background(), artifact.Path, artifact.SHA256, artifact.ByteCount, 1); err != nil {
		t.Fatalf("verify numeric JSONL artifact: %v", err)
	}
}

func TestVerifyArtifactRejectsModifiedAndIncompleteFiles(t *testing.T) {
	archive, err := NewArchive(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	artifact, err := archive.WritePart(context.Background(), "academico.alumnos", "run-c", 1, []string{"id"}, [][]any{{int32(1)}})
	if err != nil {
		t.Fatal(err)
	}
	if err := VerifyArtifact(context.Background(), artifact.Path, artifact.SHA256, artifact.ByteCount, 2); err == nil {
		t.Fatal("incorrect manifest row count was accepted")
	}
	if err := os.WriteFile(artifact.Path, []byte("corrupted"), 0640); err != nil {
		t.Fatal(err)
	}
	if err := VerifyArtifact(context.Background(), artifact.Path, artifact.SHA256, artifact.ByteCount, artifact.RecordCount); err == nil {
		t.Fatal("modified artifact was accepted")
	}
}
