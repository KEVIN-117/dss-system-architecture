[CmdletBinding()]
param(
    [switch]$KeepStackOnFailure,
    [switch]$KeepStack
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$monorepoRoot = Join-Path $repoRoot 'dss-monorepo'
$e2eDirectory = Join-Path $monorepoRoot 'apps\rector-dashboard-e2e'
$e2eEnvFile = Join-Path $e2eDirectory '.env.e2e'
$composeFile = Join-Path $repoRoot 'docker-compose.prediction-e2e.yml'

if (-not (Test-Path -LiteralPath $e2eEnvFile)) {
    throw "Missing ignored E2E configuration: $e2eEnvFile. Copy .env.e2e.example to .env.e2e and fill the local test values."
}

foreach ($sourceLine in Get-Content -LiteralPath $e2eEnvFile) {
    $line = $sourceLine.Trim()
    if (-not $line -or $line.StartsWith('#')) { continue }
    $separator = $line.IndexOf('=')
    if ($separator -lt 1) { continue }
    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

$required = @(
    'PREDICTION_E2E_PROGRAM_REF', 'PREDICTION_E2E_CUT_ID',
    'PREDICTION_E2E_RECTOR_USERNAME', 'PREDICTION_E2E_RECTOR_PASSWORD',
    'PREDICTION_E2E_OUT_OF_SCOPE_USERNAME', 'PREDICTION_E2E_OUT_OF_SCOPE_PASSWORD'
)
$missing = @($required | Where-Object { -not [Environment]::GetEnvironmentVariable($_, 'Process') })
if ($missing.Count -gt 0) { throw "E2E configuration is incomplete: $($missing -join ', '). Values were not printed." }

$env:PREDICTION_SERVICE_URL = 'http://localhost:18007'
$env:NEXT_PUBLIC_BFF_URL = 'http://localhost:3006'
$env:BFF_BASE_URL = 'http://localhost:3006'
$env:RECTOR_DASHBOARD_BASE_URL = 'http://localhost:3004'
$env:RECTOR_DASHBOARD_PORT_E2E = '3004'
$env:BFF_PORT_E2E = '3006'
# Reuse already-running local BFF/dashboard servers when present. This avoids
# port collisions while still allowing Playwright to start them when absent.
$env:PREDICTION_E2E_FORCE_SERVER = '0'
$env:DEBUG = 'pw:webserver'
$project = "pred007-e2e-$PID"
$env:PREDICTION_IMAGE_TAG = $project
$composeArgs = @('-p', $project, '-f', $composeFile)
$failed = $false

Push-Location $repoRoot
try {
    Write-Host 'Building isolated prediction API/worker images and Faker bundle preparer…'
    & docker compose @composeArgs build prediction-e2e-api prediction-e2e-worker prediction-e2e-prepare
    if ($LASTEXITCODE -ne 0) { throw 'Docker image build failed.' }

    Write-Host 'Preparing a test-only model bundle from the selected read-only DW program/cut…'
    & docker compose @composeArgs run --rm --no-deps prediction-e2e-prepare
    if ($LASTEXITCODE -ne 0) { throw 'Faker DW bundle preparation failed.' }

    Write-Host 'Starting isolated API/worker and RabbitMQ…'
    & docker compose @composeArgs up -d prediction-e2e-rabbitmq prediction-e2e-api prediction-e2e-worker
    if ($LASTEXITCODE -ne 0) { throw 'Isolated Compose services failed to start.' }
    $deadline = (Get-Date).AddMinutes(2)
    $healthy = $false
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri 'http://localhost:18007/' -TimeoutSec 3
            if ($response.StatusCode -eq 200) { $healthy = $true; break }
        } catch { Start-Sleep -Seconds 2 }
    }
    if (-not $healthy) { throw 'Prediction API did not become healthy within two minutes.' }

    Write-Host 'Running the Rector Playwright E2E through real Keycloak and BFF sessions…'
    Push-Location $monorepoRoot
    try {
        & bun nx run @dss-monorepo/rector-dashboard-e2e:e2e -- --project=chromium --grep='PRED-007'
        if ($LASTEXITCODE -ne 0) { throw 'PRED-007 Playwright E2E failed.' }
    } finally {
        Pop-Location
    }
} catch {
    $failed = $true
    throw
} finally {
    Pop-Location
    $preserveStack = $KeepStack -or ($failed -and $KeepStackOnFailure)
    if (-not $preserveStack) {
        Write-Host "Removing this run's isolated Compose project and named volumes…"
        & docker compose @composeArgs down --volumes --remove-orphans
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Compose cleanup reported an error.' }
    } else {
        Write-Warning "The isolated test stack was kept as Compose project $project. Use 'docker compose -p $project -f docker-compose.prediction-e2e.yml down --volumes' to remove it when finished."
    }
}
