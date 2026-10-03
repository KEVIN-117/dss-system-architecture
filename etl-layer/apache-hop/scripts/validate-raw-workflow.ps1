$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$workflowPath = Join-Path $projectRoot 'etl-layer\apache-hop\project-uatf\workflows\main_orchestrator.hwf'
$pipelinePath = Join-Path $projectRoot 'etl-layer\apache-hop\project-uatf\pipelines\pl_read_raw_bundle.hpl'
$composePath = Join-Path $projectRoot 'docker-compose.yml'
$integrationComposePath = Join-Path $projectRoot 'infra\dw-integration\dw-integration-test.yml'
$dockerfilePath = Join-Path $projectRoot 'etl-layer\apache-hop\Dockerfile'

[xml]$workflow = Get-Content -LiteralPath $workflowPath -Raw
[xml]$pipeline = Get-Content -LiteralPath $pipelinePath -Raw
$compose = Get-Content -LiteralPath $composePath -Raw
$integrationCompose = Get-Content -LiteralPath $integrationComposePath -Raw
$dockerfile = Get-Content -LiteralPath $dockerfilePath -Raw
$verifierScript = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'verify-raw-bundle.sh') -Raw
$integrationEnvironmentPath = Join-Path $projectRoot 'etl-layer\apache-hop\config\environments\integration-env.json'
$integrationEnvironment = Get-Content -LiteralPath $integrationEnvironmentPath -Raw | ConvertFrom-Json

$actions = @($workflow.workflow.actions.action)
$preflight = $actions | Where-Object { $_.name -eq 'Preflight RAW bundle' }
$reader = $actions | Where-Object { $_.name -eq 'Read verified RAW JSONL' }
$abort = $actions | Where-Object { $_.type -eq 'ABORT' }
if (-not $preflight -or $preflight.type -ne 'SHELL' -or $preflight.filename -ne '/usr/local/bin/verify-raw-bundle.sh') {
    throw 'Workflow does not invoke the RAW verifier before reading.'
}
if (-not $reader -or $reader.type -ne 'PIPELINE' -or $reader.filename -notlike '*/pl_read_raw_bundle.hpl') {
    throw 'Workflow does not invoke the RAW reader pipeline.'
}
if ($reader.run_configuration -ne 'local') {
    throw 'RAW reader pipeline action must select the local run configuration.'
}
if (-not $abort) {
    throw 'Workflow must stop on verification or read errors.'
}
$runIdParameter = @($workflow.workflow.parameters.parameter | Where-Object { $_.name -eq 'RUN_ID' })
if ($runIdParameter.Count -ne 1) {
    throw 'Workflow does not declare the required RUN_ID parameter.'
}
$preflightFailure = @($workflow.workflow.hops.hop | Where-Object { $_.from -eq $preflight.name -and $_.to -eq $abort.name -and $_.evaluation -eq 'N' })
if (-not $preflightFailure.Count) {
    throw 'A failed preflight is not routed to Abort.'
}
$preflightSuccess = @($workflow.workflow.hops.hop | Where-Object { $_.from -eq $preflight.name -and $_.to -eq $reader.name -and $_.evaluation -eq 'Y' -and $_.unconditional -eq 'N' })
if (-not $preflightSuccess.Count) {
    throw 'RAW reading must be gated by a successful preflight result.'
}
$readerFailure = @($workflow.workflow.hops.hop | Where-Object { $_.from -eq $reader.name -and $_.to -eq $abort.name -and $_.evaluation -eq 'N' })
if (-not $readerFailure.Count) {
    throw 'A failed RAW read is not routed to Abort.'
}

$textInput = @($pipeline.pipeline.transform | Where-Object { $_.type -eq 'TextFileInput2' })
$files = @($textInput | ForEach-Object { $_.file })
$expectedSources = @(
    'public.uatf_datos', 'academico.alumnos', 'public.postulantes',
    'academico.alm_programas', 'academico.pln_materias', 'academico.notas_planilla',
    'academico.alm_programas_facultades', 'public.prs_colegios', 'public.lugar_localidad'
)
$actualSources = @($files | ForEach-Object { ([string]$_.name -replace '^/dw-raw/source=', '' -replace '/run_id=.*$', '') })
if ($textInput.Count -ne 9 -or $pipeline.pipeline.transform.Count -ne 9 -or $files.Count -ne 9) {
    throw 'RAW reader must have one terminal text input per source and nine source paths; rows must not be sent to a publishing transform.'
}
if (@(Compare-Object $expectedSources $actualSources).Count -ne 0) {
    throw 'RAW reader source directories do not match the nine DW-001 contracts.'
}
if (@($files | Where-Object { $_.compression -ne 'GZip' -or $_.file_required -ne 'N' }).Count -ne 0) {
    throw 'Every RAW source path must read GZip and allow empty sources (already checked by preflight).'
}
if ($dockerfile -notmatch 'raw-verify' -or $dockerfile -notmatch 'verify-raw-bundle\.sh /usr/local/bin/verify-raw-bundle\.sh' -or $compose -notmatch 'dw-raw:/dw-raw:ro' -or $compose -notmatch 'DB_DW_VERIFY_USER') {
    throw 'Hop image, read-only RAW volume, or verifier credentials are not configured.'
}
if ($verifierScript -notmatch 'run_id=\$\{1:-\$\{RUN_ID:-\}\}' -or $integrationCompose -notmatch 'DW012_HOP_TEST_RUN_ID') {
    throw 'The Hop preflight must have an environment fallback and share the synthetic run_id with extraction.'
}
if ($integrationCompose -notmatch 'raw-extract-hop-fixture' -or $integrationCompose -notmatch 'hop-raw-integration-test' -or $integrationCompose -notmatch 'target: hop-runner' -or $integrationCompose -notmatch 'dss-hop-runner:dw-012-test' -or $integrationCompose -notmatch 'HOP_FILE_PATH: /files/project/workflows/main_orchestrator.hwf' -or $integrationCompose -notmatch 'HOP_RUN_CONFIG: local' -or $integrationCompose -notmatch 'RUN_ID: "\$\{DW012_HOP_TEST_RUN_ID' -or $integrationCompose -notmatch '"\$\{DW012_HOP_TEST_RUN_ID' -or $integrationCompose -match 'entrypoint: \["/opt/hop/hop-run.sh"\]') {
    throw 'The isolated fixture-to-Hop Docker integration path is not configured.'
}
$integrationVariables = @{}
foreach ($variable in $integrationEnvironment.variables) { $integrationVariables[$variable.name] = $variable.value }
if ($integrationCompose -notmatch 'HOP_ENVIRONMENT_NAME: integration' -or
    $integrationCompose -notmatch 'integration-env\.json' -or
    $integrationVariables.DB_DW_HOST -ne 'postgres-dw' -or
    $integrationVariables.DB_DW_PORT -ne '5432' -or
    $integrationVariables.DB_DW_NAME -ne 'dw_integration' -or
    $integrationVariables.DB_DW_USER -ne 'raw_verify_test') {
    throw 'The Hop integration lifecycle must target the isolated DW fixture, not the developer dev environment.'
}

Write-Output 'DW-012 Hop static validation passed: preflight gate, failure routes, and nine GZip JSONL source paths.'
