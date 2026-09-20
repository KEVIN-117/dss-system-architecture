-- Legacy DW-002 record created before DW-004 introduces the run foreign key.
-- It must survive the NOT VALID foreign key added by migration 0003.

INSERT INTO etl_control.academic_period_closure (
    gestion, periodo, created_by_subject, closure_reason
) VALUES (
    2027, 7, 'dsa:upgrade-fixture', 'Cierre legado previo a DW-004'
);

SELECT etl_control.transition_academic_period_closure(
    2027::smallint,
    7::smallint,
    'CERRADO'::varchar(16),
    'dsa:upgrade-fixture'::varchar(255),
    'Cierre legado autorizado',
    '2027-11-30 18:00:00-04'::timestamptz
);

SELECT etl_control.transition_academic_period_closure(
    2027::smallint,
    7::smallint,
    'PROCESADO'::varchar(16),
    'load-manager:legacy'::varchar(255),
    'Procesamiento legado previo a DW-004',
    NULL,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
);
