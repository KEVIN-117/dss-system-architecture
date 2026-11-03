$ErrorActionPreference = "Stop"

$composeJson = docker compose config --format json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
    throw "Could not resolve the local Compose configuration."
}

$databaseUrl = [string]$composeJson.services.'prediction-service'.environment.PREDICTION_DATABASE_URL
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    throw "Compose does not define PREDICTION_DATABASE_URL for the local DW."
}

# Compose's service hostname is not reachable from the host Python process.
# Route the existing local dev connection through the published DW port.
$databaseUrl = $databaseUrl -replace '@postgres-dw:5432/', '@localhost:5434/'
$env:PREDICTION_DW_DATABASE_URL = $databaseUrl
$env:PREDICTION_ALLOWED_ROLES = '["RECTOR"]'
$env:TEMP = Join-Path (Get-Location) ".test-tmp"
$env:TMP = $env:TEMP

& .\.venv\Scripts\python.exe tests\integration\prediction_faker_e2e.py
if ($LASTEXITCODE -ne 0) {
    throw "Faker DW end-to-end inference failed with exit code $LASTEXITCODE."
}
