package domain

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"
)

type SnapshotPolicy string

const (
	SnapshotFull        SnapshotPolicy = "FULL"
	SnapshotAcademicCut SnapshotPolicy = "ACADEMIC_CUT"
)

type DataClassification string

const (
	ClassificationPublic     DataClassification = "PUBLIC"
	ClassificationInternal   DataClassification = "INTERNAL"
	ClassificationPersonal   DataClassification = "PERSONAL"
	ClassificationRestricted DataClassification = "RESTRICTED"
)

type SourceColumn struct {
	Name             string             `json:"name" yaml:"name"`
	DataType         string             `json:"data_type" yaml:"data_type"`
	Nullable         bool               `json:"nullable" yaml:"nullable"`
	Classification   DataClassification `json:"classification" yaml:"classification"`
	ExpectedTypeOIDs []uint32           `json:"-" yaml:"-"`
}

type SourceContract struct {
	ID             string         `json:"contract_id" yaml:"contract_id"`
	Version        string         `json:"contract_version" yaml:"contract_version"`
	Schema         string         `json:"source_schema" yaml:"source_schema"`
	Object         string         `json:"source_object" yaml:"source_object"`
	QueryFile      string         `json:"query_file" yaml:"query_file"`
	StableOrder    []string       `json:"stable_order" yaml:"stable_order"`
	SnapshotPolicy SnapshotPolicy `json:"snapshot_policy" yaml:"snapshot_policy"`
	Columns        []SourceColumn `json:"columns" yaml:"columns"`
}

var safeSQLIdentifier = regexp.MustCompile(`^[a-z_][a-z0-9_]*$`)

func (c SourceContract) Validate() error {
	if strings.TrimSpace(c.ID) == "" || strings.TrimSpace(c.Version) == "" ||
		!safeSQLIdentifier.MatchString(c.Schema) || !safeSQLIdentifier.MatchString(c.Object) ||
		strings.TrimSpace(c.QueryFile) == "" || len(c.StableOrder) == 0 || len(c.Columns) == 0 {
		return fmt.Errorf("%w: id, version, source identifier, query, order, and columns are required", ErrInvalidSource)
	}
	if c.SnapshotPolicy != SnapshotFull && c.SnapshotPolicy != SnapshotAcademicCut {
		return fmt.Errorf("%w: unsupported snapshot policy %q", ErrInvalidSource, c.SnapshotPolicy)
	}
	columns := make(map[string]struct{}, len(c.Columns))
	for _, column := range c.Columns {
		if !safeSQLIdentifier.MatchString(column.Name) || strings.TrimSpace(column.DataType) == "" {
			return fmt.Errorf("%w: invalid column definition", ErrInvalidSource)
		}
		if _, exists := columns[column.Name]; exists {
			return fmt.Errorf("%w: duplicate column %q", ErrInvalidSource, column.Name)
		}
		columns[column.Name] = struct{}{}
		switch column.Classification {
		case ClassificationPublic, ClassificationInternal, ClassificationPersonal, ClassificationRestricted:
		default:
			return fmt.Errorf("%w: invalid classification for column %q", ErrInvalidSource, column.Name)
		}
	}
	seenOrder := make(map[string]struct{}, len(c.StableOrder))
	for _, key := range c.StableOrder {
		if _, ok := columns[key]; !ok {
			return fmt.Errorf("%w: stable order key %q is not declared", ErrInvalidSource, key)
		}
		if _, duplicate := seenOrder[key]; duplicate {
			return fmt.Errorf("%w: duplicate stable order key %q", ErrInvalidSource, key)
		}
		seenOrder[key] = struct{}{}
	}
	return nil
}

type ManifestStatus string

const (
	ManifestPending  ManifestStatus = "PENDIENTE"
	ManifestComplete ManifestStatus = "COMPLETO"
	ManifestFailed   ManifestStatus = "FALLIDO"
)

type SourceManifest struct {
	RunID           RunID           `json:"run_id"`
	ContractID      string          `json:"source_contract_id"`
	ContractVersion string          `json:"source_contract_version"`
	SourceSchema    string          `json:"source_schema"`
	SourceObject    string          `json:"source_object"`
	QuerySHA256     string          `json:"source_query_sha256"`
	SchemaSHA256    string          `json:"source_schema_sha256,omitempty"`
	StableOrderKey  string          `json:"stable_order_key"`
	Period          *AcademicPeriod `json:"period,omitempty"`
	CutAt           *time.Time      `json:"snapshot_cut_at,omitempty"`
	RecordCount     *int64          `json:"record_count,omitempty"`
	Status          ManifestStatus  `json:"status"`
	ExtractedAt     time.Time       `json:"extracted_at,omitempty"`
	CompletedAt     *time.Time      `json:"completed_at,omitempty"`
}

type ManifestArtifact struct {
	Kind        string `json:"artifact_kind"`
	URI         string `json:"artifact_uri"`
	SHA256      string `json:"artifact_sha256"`
	ByteCount   int64  `json:"byte_count"`
	RecordCount *int64 `json:"record_count,omitempty"`
}

type ArtifactKind string

const (
	ArtifactRawExtract     ArtifactKind = "RAW_EXTRACT"
	ArtifactQueryPlan      ArtifactKind = "QUERY_PLAN"
	ArtifactSchemaSnapshot ArtifactKind = "SCHEMA_SNAPSHOT"
	ArtifactQualityReport  ArtifactKind = "QUALITY_REPORT"
)

var sha256Hex = regexp.MustCompile(`^[0-9a-f]{64}$`)

func (m SourceManifest) Validate() error {
	if m.RunID.IsZero() || strings.TrimSpace(m.ContractID) == "" || strings.TrimSpace(m.ContractVersion) == "" ||
		!safeSQLIdentifier.MatchString(m.SourceSchema) || !safeSQLIdentifier.MatchString(m.SourceObject) ||
		strings.TrimSpace(m.StableOrderKey) == "" || !sha256Hex.MatchString(m.QuerySHA256) {
		return fmt.Errorf("%w: missing or malformed identity, order, or query checksum", ErrInvalidManifest)
	}
	if m.Period != nil {
		if err := m.Period.Validate(); err != nil {
			return fmt.Errorf("%w: %v", ErrInvalidManifest, err)
		}
	}
	if m.RecordCount != nil && *m.RecordCount < 0 {
		return fmt.Errorf("%w: record count cannot be negative", ErrInvalidManifest)
	}
	switch m.Status {
	case ManifestPending, ManifestFailed:
		return nil
	case ManifestComplete:
		if !sha256Hex.MatchString(m.SchemaSHA256) || m.RecordCount == nil || m.CompletedAt == nil || m.CompletedAt.IsZero() {
			return fmt.Errorf("%w: completed manifest requires schema checksum, count, and completion time", ErrInvalidManifest)
		}
	default:
		return fmt.Errorf("%w: unsupported status %q", ErrInvalidManifest, m.Status)
	}
	return nil
}

func (a ManifestArtifact) Validate() error {
	parsedURI, parseErr := url.Parse(strings.TrimSpace(a.URI))
	switch ArtifactKind(a.Kind) {
	case ArtifactRawExtract, ArtifactQueryPlan, ArtifactSchemaSnapshot, ArtifactQualityReport:
	default:
		return fmt.Errorf("%w: unsupported artifact kind %q", ErrInvalidManifest, a.Kind)
	}
	if strings.TrimSpace(a.URI) == "" || parseErr != nil ||
		(parsedURI != nil && parsedURI.User != nil) || !sha256Hex.MatchString(a.SHA256) ||
		a.ByteCount < 0 || (a.RecordCount != nil && *a.RecordCount < 0) {
		return fmt.Errorf("%w: malformed artifact or possible embedded credential", ErrInvalidManifest)
	}
	return nil
}
