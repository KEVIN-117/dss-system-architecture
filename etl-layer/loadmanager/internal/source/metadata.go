package source

import (
	"errors"
	"fmt"
)

// ColumnMetadata is the source catalog shape, not the result-set shape.
// PostgreSQL's field OID alone cannot detect a changed varchar length or
// nullable contract field.
type ColumnMetadata struct {
	Name         string `json:"name"`
	TypeOID      uint32 `json:"type_oid"`
	TypeModifier int32  `json:"type_modifier"`
	NotNull      bool   `json:"not_null"`
	Collation    string `json:"collation,omitempty"`
}

func ValidateUATFDatosMetadata(columns []ColumnMetadata, uniqueIDRA bool) error {
	if len(columns) != len(uatfDatosColumns) || !uniqueIDRA {
		return errors.New("source contract columns or unique id_ra constraint are missing")
	}
	for i, column := range columns {
		if column.Name != uatfDatosColumns[i] {
			return fmt.Errorf("source column %d does not match the approved contract", i+1)
		}
		allowedType := false
		switch i {
		case 0:
			allowedType = column.TypeOID == 1043 && column.TypeModifier == 14 && column.NotNull
		case 1:
			allowedType = column.TypeOID == 1043 && column.TypeModifier == 5
		case 2, 6:
			allowedType = column.TypeOID == 21 && column.TypeModifier == -1
		case 3:
			allowedType = column.TypeOID == 23 && column.TypeModifier == -1
		case 4, 5:
			// DW-008's fixture widens these optional references to integer.
			allowedType = (column.TypeOID == 21 || column.TypeOID == 23) && column.TypeModifier == -1
		case 7:
			allowedType = column.TypeOID == 1114 && (column.TypeModifier == -1 || column.TypeModifier == 6)
		}
		if !allowedType || ((i == 2 || i == 7) && !column.NotNull) {
			return fmt.Errorf("source column %s has an incompatible type, length, or nullability", column.Name)
		}
	}
	return nil
}
