package domain

import (
	"testing"
	"time"
)

func TestSourceContractValidatesStableOrderAgainstDeclaredColumns(t *testing.T) {
	contract := SourceContract{
		ID: "01-uatf-datos", Version: "1.0.0", Schema: "public", Object: "uatf_datos",
		QueryFile: "01_uatf_datos.sql", StableOrder: []string{"id_ra"}, SnapshotPolicy: SnapshotFull,
		Columns: []SourceColumn{{Name: "id_ra", DataType: "varchar(10)", Classification: ClassificationPersonal}},
	}
	if err := contract.Validate(); err != nil {
		t.Fatalf("valid source contract rejected: %v", err)
	}
	contract.StableOrder = []string{"not_declared"}
	if err := contract.Validate(); err == nil {
		t.Fatal("stable order referencing an undeclared column must be rejected")
	}
}

func TestCompleteManifestRequiresHashesCountAndCompletionTime(t *testing.T) {
	count := int64(12)
	completed := time.Date(2026, time.October, 1, 12, 0, 0, 0, time.UTC)
	manifest := SourceManifest{
		RunID: NewRunID(), ContractID: "01-uatf-datos", ContractVersion: "1.0.0",
		SourceSchema: "public", SourceObject: "uatf_datos", QuerySHA256: testHash('a'),
		SchemaSHA256: testHash('b'), StableOrderKey: "id_ra ASC", RecordCount: &count,
		Status: ManifestComplete, CompletedAt: &completed,
	}
	if err := manifest.Validate(); err != nil {
		t.Fatalf("valid complete manifest rejected: %v", err)
	}
	manifest.SchemaSHA256 = ""
	if err := manifest.Validate(); err == nil {
		t.Fatal("complete manifest without schema hash must be rejected")
	}
}

func TestArtifactRejectsCredentialLikeURI(t *testing.T) {
	artifact := ManifestArtifact{Kind: "RAW_EXTRACT", URI: "s3://user:secret@bucket/file", SHA256: testHash('a')}
	if err := artifact.Validate(); err == nil {
		t.Fatal("credential-like URI must be rejected")
	}
}

func TestArtifactAllowsAtInPathWithoutUserInfo(t *testing.T) {
	artifact := ManifestArtifact{Kind: "RAW_EXTRACT", URI: "file:///tmp/run@archive/data.csv", SHA256: testHash('a')}
	if err := artifact.Validate(); err != nil {
		t.Fatalf("path without URI credentials must be allowed: %v", err)
	}
}

func testHash(character byte) string {
	result := make([]byte, 64)
	for i := range result {
		result[i] = character
	}
	return string(result)
}
