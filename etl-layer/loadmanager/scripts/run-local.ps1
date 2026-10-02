$ErrorActionPreference = 'Stop'

$moduleRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$repoRoot = (Resolve-Path (Join-Path $moduleRoot '..\..')).Path
$composeFile = Join-Path $repoRoot 'infra\dw-integration\dw-integration-test.yml'
$envFile = Join-Path $moduleRoot '.env'
$configFile = Join-Path $moduleRoot 'configs\loadmanager.example.yaml'

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "No existe $envFile. Copia .env.example a .env y usa únicamente credenciales de fixtures locales."
}

# Parse KEY=VALUE dotenv lines without executing .env as PowerShell code.
foreach ($line in Get-Content -LiteralPath $envFile) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    if ($trimmed -notmatch '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        throw 'Formato inválido en .env; se esperaba KEY=VALUE.'
    }
    $name = $Matches[1]
    $value = $Matches[2].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

$requiredVariables = @(
    'DB_TX_HOST', 'DB_TX_PORT', 'DB_TX_NAME', 'DB_TX_USER', 'DB_TX_PASS', 'DB_TX_SSLMODE',
    'DB_DW_HOST', 'DB_DW_PORT', 'DB_DW_NAME', 'DB_DW_USER', 'DB_DW_PASS', 'DB_DW_SSLMODE'
)
foreach ($name in $requiredVariables) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, 'Process'))) {
        throw "Falta definir $name en .env."
    }
}

$env:LOADMANAGER_CONFIG = $configFile
$composeArgs = @('compose', '-f', $composeFile)

Push-Location $moduleRoot
try {
    & docker @composeArgs up -d postgres-dw jachasun-fixture
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron iniciar las bases de fixtures.' }

    & docker @composeArgs run --rm migration-only
    if ($LASTEXITCODE -ne 0) { throw 'El migrador DW falló; no se iniciará Load Manager.' }

    # Fixture seeding is separate from idempotent migrations. A partial seed
    # must be reviewed, never overwritten implicitly.
    $status = & docker @composeArgs exec -T postgres-dw psql -U dw_test -d dw_integration -tAc `
        "SELECT (to_regrole('loadmanager_test') IS NOT NULL)::text || ',' || (EXISTS(SELECT 1 FROM etl_control.etl_execution WHERE run_id = '88888888-8888-8888-8888-888888888888'))::text" 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo inspeccionar el estado de fixtures.' }
    $fixtureState = ($status -join '').Trim()
    if ($fixtureState -eq 'true,false' -or $fixtureState -eq 'false,true') {
        throw 'Fixtures parcialmente preparados; revisar el DW efímero antes de continuar.'
    }
    $initialized = $fixtureState -eq 'true,true'

    if (-not $initialized) {
        & docker @composeArgs run --rm integration-test
        if ($LASTEXITCODE -ne 0) {
            throw "Fixture setup/regression tests failed. Reset only these ephemeral databases with: docker compose -f `"$composeFile`" down"
        }
    }

    $env:LOADMANAGER_QUERY_DIR = Join-Path $repoRoot 'infra\postgres-tx\extract'

    Write-Host 'Iniciando Load Manager. Health: http://localhost:8088/healthz ; readiness: http://localhost:8088/readyz'
    Write-Host 'Este proceso solo expone health/readiness; todavía no dispara la extracción.'
    & go run ./cmd/loadmanager
    if ($LASTEXITCODE -ne 0) { throw 'Load Manager finalizó con error.' }
}
finally {
    Pop-Location
}
