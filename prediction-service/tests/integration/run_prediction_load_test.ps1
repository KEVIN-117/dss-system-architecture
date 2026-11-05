param(
    [switch]$ConfirmDevelopment,
    [int]$DurationSeconds = 30,
    [int]$Clients = 2,
    [string]$Output = "prediction-service/.test-tmp/PRED-008-load-report.json",
    [switch]$Enforce,
    [switch]$InjectWorkerCrash,
    [double]$MaxP95Regression,
    [double]$MaxErrorRate
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$python = Join-Path $repoRoot "prediction-service\.venv\Scripts\python.exe"
$driver = Join-Path $PSScriptRoot "prediction_load_test.py"

if (-not $ConfirmDevelopment) {
    throw "Pass -ConfirmDevelopment only after verifying the target is the local development/test stack."
}
if (-not (Test-Path -LiteralPath $python)) {
    throw "Python virtual environment not found at $python."
}
foreach ($name in @("PREDICTION_LOAD_PROGRAM_REF", "PREDICTION_LOAD_CUT_ID", "PREDICTION_LOAD_SUBJECT_REF")) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        throw "Required environment variable is missing: $name"
    }
}
if ([string]::IsNullOrWhiteSpace($env:PREDICTION_LOAD_ACCESS_TOKEN) -and
    ([string]::IsNullOrWhiteSpace($env:PREDICTION_LOAD_BFF_URL) -or
     [string]::IsNullOrWhiteSpace($env:PREDICTION_LOAD_SESSION_COOKIE))) {
    throw "Set PREDICTION_LOAD_ACCESS_TOKEN, or use BFF session mode with PREDICTION_LOAD_BFF_URL and PREDICTION_LOAD_SESSION_COOKIE."
}
if ($env:PREDICTION_ENV -eq "production") {
    throw "Refusing to run against PREDICTION_ENV=production."
}

$env:PRED008_CONFIRM_DEVELOPMENT = "true"
$env:PREDICTION_LOAD_DURATION_SECONDS = "$DurationSeconds"
$env:PREDICTION_LOAD_CLIENTS = "$Clients"
$outputPath = Join-Path $repoRoot $Output
$arguments = @($driver, "--output", $outputPath)
if ($Enforce) {
    if ($PSBoundParameters.ContainsKey("MaxP95Regression") -eq $false -or
        $PSBoundParameters.ContainsKey("MaxErrorRate") -eq $false) {
        throw "-Enforce requires explicit -MaxP95Regression and -MaxErrorRate values agreed for this environment."
    }
    $arguments += @("--enforce", "--max-p95-regression", "$MaxP95Regression", "--max-error-rate", "$MaxErrorRate")
}
if ($InjectWorkerCrash) {
    $env:PRED008_CONFIRM_WORKER_CRASH = "true"
    $arguments += "--inject-worker-crash"
}

Push-Location $repoRoot
try {
    & $python @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "PRED-008 load characterization failed with exit code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}
