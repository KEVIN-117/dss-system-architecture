[CmdletBinding()]
param(
    [string]$ProgramRef = "ADM",
    [string]$CutId = "79",
    [string]$SubjectRef = "6377",
    [int]$DurationSeconds = 10,
    [int]$Clients = 2,
    [switch]$ConfirmDevelopment,
    [switch]$InjectWorkerCrash,
    [switch]$Enforce,
    [double]$MaxP95Regression,
    [double]$MaxErrorRate,
    [string]$Output = "prediction-service/.test-tmp/PRED-008-isolated-load-report.json"
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$composeFile = Join-Path $repoRoot 'docker-compose.prediction-e2e.yml'
$pythonRunner = Join-Path $PSScriptRoot 'run_prediction_load_test.ps1'
$python = Join-Path $repoRoot 'prediction-service\.venv\Scripts\python.exe'
$authPreflight = Join-Path $PSScriptRoot 'prediction_load_auth_preflight.py'
$project = "pred008-load-$PID"
$composeArgs = @('-p', $project, '-f', $composeFile)
$isolatedProjectCreated = $false
$sessionCookieAddedByPrompt = $false
$displacedApiContainerId = $null

function Test-LoopbackPortAvailable([int]$Port) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try { $listener.Start(); return $true }
    catch { return $false }
    finally { $listener.Stop() }
}

function Free-BffPredictionPort {
    # The existing BFF is configured for localhost:18007. Stop only a known
    # PRED-007 E2E API container; never terminate an arbitrary port owner.
    $owners = @(& docker ps --filter 'publish=18007' --format '{{.ID}}')
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the Docker owner of localhost:18007.' }
    $owners = @($owners | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($owners.Count -gt 1) { throw 'Multiple containers report localhost:18007; refusing to stop any of them.' }
    if ($owners.Count -eq 1) {
        $containerId = $owners[0].Trim()
        $inspection = @(& docker inspect $containerId | ConvertFrom-Json)
        if ($LASTEXITCODE -ne 0 -or $inspection.Count -eq 0) { throw 'Could not inspect the container using localhost:18007.' }
        $labels = $inspection[0].Config.Labels
        $service = $labels.'com.docker.compose.service'
        $ownerProject = $labels.'com.docker.compose.project'
        $containerName = $inspection[0].Name.TrimStart('/')
        if ($service -ne 'prediction-e2e-api' -or $ownerProject -notmatch '^pred007-e2e(?:-|$)') {
            throw "localhost:18007 is held by '$containerName' (Compose service '$service', project '$ownerProject'); refusing to stop an unrecognized service. Stop it explicitly, then rerun."
        }
        Write-Host "Temporarily stopping the PRED-007 E2E API '$containerName' so the BFF can reach the isolated PRED-008 API…"
        & docker stop $containerId | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Could not stop the recognized PRED-007 E2E API '$containerName'." }
        $script:displacedApiContainerId = $containerId
    } elseif (-not (Test-LoopbackPortAvailable 18007)) {
        throw 'localhost:18007 is occupied by a host process that is not a recognized PRED-007 E2E API; free it explicitly and rerun.'
    }

    $releaseDeadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $releaseDeadline) {
        if (Test-LoopbackPortAvailable 18007) { return }
        Start-Sleep -Milliseconds 500
    }
    throw 'localhost:18007 did not become available after stopping the recognized PRED-007 E2E API.'
}

function Set-ReadOnlyDwTelemetryDsn {
    if (-not [string]::IsNullOrWhiteSpace($env:PREDICTION_LOAD_DW_DATABASE_URL)) {
        return
    }

    $envFile = Join-Path $repoRoot '.env'
    if (-not (Test-Path -LiteralPath $envFile)) { return }

    $line = Get-Content -LiteralPath $envFile | Where-Object {
        $_ -match '^\s*PREDICTION_DW_DATABASE_URL\s*='
    } | Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace($line)) { return }

    $dsn = ($line -replace '^\s*PREDICTION_DW_DATABASE_URL\s*=\s*', '').Trim()
    if (($dsn.StartsWith('"') -and $dsn.EndsWith('"')) -or
        ($dsn.StartsWith("'") -and $dsn.EndsWith("'"))) {
        $dsn = $dsn.Substring(1, $dsn.Length - 2)
    }
    if ([string]::IsNullOrWhiteSpace($dsn)) { return }

    try {
        $builder = [System.UriBuilder]::new($dsn)
        if ($builder.Host -eq 'postgres-dw') {
            # The driver runs on the host, while postgres-dw is the Compose DNS name.
            $builder.Host = 'localhost'
            $builder.Port = 5434
        }
        $env:PREDICTION_LOAD_DW_DATABASE_URL = $builder.Uri.AbsoluteUri
    } catch {
        throw 'PREDICTION_DW_DATABASE_URL in .env is not a valid PostgreSQL URL; DW credentials were not printed.'
    }
}

function Test-BffSession([string]$Stage, [string]$Cookie, [string]$Role) {
    if ([string]::IsNullOrWhiteSpace($Cookie)) { return }
    if (-not (Test-Path -LiteralPath $python)) {
        throw "Python virtual environment not found at $python; cannot validate the BFF session $Stage."
    }
    $previousCookie = $env:PREDICTION_LOAD_PREFLIGHT_COOKIE
    $previousRole = $env:PREDICTION_LOAD_REQUIRED_ROLE
    $env:PREDICTION_LOAD_PREFLIGHT_COOKIE = $Cookie
    $env:PREDICTION_LOAD_REQUIRED_ROLE = $Role
    & $python $authPreflight
    $preflightExitCode = $LASTEXITCODE
    if ($null -eq $previousCookie) { Remove-Item Env:PREDICTION_LOAD_PREFLIGHT_COOKIE -ErrorAction SilentlyContinue }
    else { $env:PREDICTION_LOAD_PREFLIGHT_COOKIE = $previousCookie }
    if ($null -eq $previousRole) { Remove-Item Env:PREDICTION_LOAD_REQUIRED_ROLE -ErrorAction SilentlyContinue }
    else { $env:PREDICTION_LOAD_REQUIRED_ROLE = $previousRole }
    if ($preflightExitCode -ne 0) {
        throw "BFF session validation failed $Stage. Renew the local $Role session."
    }
}

if (-not $ConfirmDevelopment) {
    throw 'Pass -ConfirmDevelopment only after confirming all targets are local development/test services.'
}
if ([string]::IsNullOrWhiteSpace($ProgramRef) -or [string]::IsNullOrWhiteSpace($CutId) -or
    [string]::IsNullOrWhiteSpace($SubjectRef)) {
    throw 'ProgramRef, CutId and SubjectRef are required.'
}
if ([string]::IsNullOrWhiteSpace($env:PREDICTION_LOAD_ACCESS_TOKEN) -and
    [string]::IsNullOrWhiteSpace($env:PREDICTION_LOAD_SESSION_COOKIE)) {
    $secureCookie = Read-Host 'Pega solo el valor de dss_session de una sesión RECTOR local (entrada oculta)' -AsSecureString
    if ($secureCookie.Length -eq 0) { throw 'Se requiere una sesión SUPERADMIN local vigente.' }
    $cookiePointer = [IntPtr]::Zero
    try {
        $cookiePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureCookie)
        $cookieValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($cookiePointer)
        if ($cookieValue.StartsWith('dss_session=')) {
            $env:PREDICTION_LOAD_SESSION_COOKIE = $cookieValue
        } else {
            $env:PREDICTION_LOAD_SESSION_COOKIE = "dss_session=$cookieValue"
        }
        $sessionCookieAddedByPrompt = $true
    } finally {
        if ($cookiePointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($cookiePointer)
        }
        $secureCookie.Dispose()
        $cookieValue = $null
    }
}
if (-not (Test-Path -LiteralPath $composeFile)) { throw "Compose file not found: $composeFile" }

Set-ReadOnlyDwTelemetryDsn
if ([string]::IsNullOrWhiteSpace($env:PREDICTION_LOAD_BFF_URL)) {
    $env:PREDICTION_LOAD_BFF_URL = 'http://localhost:3006'
}
if ([string]::IsNullOrWhiteSpace($env:PREDICTION_LOAD_DASHBOARD_URL)) {
    $env:PREDICTION_LOAD_DASHBOARD_URL = 'http://localhost:3004'
}

# Validate with urllib, the same HTTP client used by the load driver. This
# confirms that the cookie survives the Playwright-to-process handoff without
# relying on PowerShell's different header handling.
Test-BffSession 'before building images' $env:PREDICTION_LOAD_SESSION_COOKIE 'RECTOR'
if ([string]::IsNullOrWhiteSpace($env:PREDICTION_LOAD_TRAINING_SESSION_COOKIE) -and
    -not [string]::IsNullOrWhiteSpace($env:PREDICTION_LOAD_SESSION_COOKIE)) {
    throw 'Set PREDICTION_LOAD_TRAINING_SESSION_COOKIE with a separate SUPERADMIN session for training jobs.'
}
Test-BffSession 'before building images' $env:PREDICTION_LOAD_TRAINING_SESSION_COOKIE 'SUPERADMIN'

Push-Location $repoRoot
try {
    $env:PREDICTION_E2E_DOCKER_NETWORK = 'dss-system-architecture_dss-net'
    Free-BffPredictionPort
    $env:PREDICTION_E2E_PROGRAM_REF = $ProgramRef
    $env:PREDICTION_E2E_CUT_ID = $CutId
    $env:PREDICTION_E2E_SUBJECT_REF = $SubjectRef
    $env:PREDICTION_IMAGE_TAG = $project

    Write-Host 'Building isolated PRED-008 API/worker and Faker bundle preparer…'
    & docker compose @composeArgs build prediction-e2e-api prediction-e2e-worker prediction-e2e-prepare
    if ($LASTEXITCODE -ne 0) { throw 'Isolated PRED-008 image build failed.' }

    Write-Host "Preparing a test-only bundle in this run's private artifact volume…"
    $isolatedProjectCreated = $true
    $prepareOutput = @(& docker compose @composeArgs run --rm --no-deps prediction-e2e-prepare)
    $prepareExitCode = $LASTEXITCODE
    $selectedSubjectRef = $null
    foreach ($line in $prepareOutput) {
        $renderedLine = [string]$line
        if ($renderedLine -match '^PREDICTION_E2E_SELECTED_SUBJECT_REF=(\d+)$') {
            $selectedSubjectRef = $Matches[1]
        } else {
            Write-Host $renderedLine
        }
    }
    if ($prepareExitCode -ne 0) { throw 'Faker bundle preparation or inference-eligibility check failed.' }
    if ([string]::IsNullOrWhiteSpace($selectedSubjectRef)) {
        throw 'The bundle preparer did not return an inference-eligible Faker subject.'
    }

    # Cold image builds can take several minutes. BFF sessions have their own
    # short TTL, so verify again before stopping the shared local API.
    Test-BffSession 'after image and bundle preparation, before starting load traffic' $env:PREDICTION_LOAD_SESSION_COOKIE 'RECTOR'
    Test-BffSession 'after image and bundle preparation, before starting load traffic' $env:PREDICTION_LOAD_TRAINING_SESSION_COOKIE 'SUPERADMIN'

    Write-Host 'Starting the isolated RabbitMQ, API and worker…'
    & docker compose @composeArgs up -d prediction-e2e-rabbitmq prediction-e2e-api prediction-e2e-worker
    if ($LASTEXITCODE -ne 0) { throw 'Isolated PRED-008 services failed to start.' }

    $deadline = (Get-Date).AddMinutes(2)
    $healthy = $false
    $lastHealthError = $null
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri 'http://localhost:18007/' -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) { $healthy = $true; break }
            $lastHealthError = "HTTP $($response.StatusCode)"
        } catch {
            # A connection timeout is normal while Uvicorn and model registry initialize.
            # Keep polling until the full startup deadline instead of aborting on one probe.
            $lastHealthError = $_.Exception.Message
        }
        Start-Sleep -Seconds 2
    }
    if (-not $healthy) {
        Write-Warning "Isolated Prediction API did not become healthy. Last probe: $lastHealthError"
        & docker compose @composeArgs ps -a
        & docker compose @composeArgs logs --no-color --tail 80 prediction-e2e-api
        throw 'Isolated Prediction API did not become healthy within two minutes; see container status and logs above.'
    }

    Test-BffSession 'before starting load traffic' $env:PREDICTION_LOAD_SESSION_COOKIE 'RECTOR'
    Test-BffSession 'before starting load traffic' $env:PREDICTION_LOAD_TRAINING_SESSION_COOKIE 'SUPERADMIN'

    $env:PREDICTION_ENV = 'development'
    if ([string]::IsNullOrWhiteSpace($env:PREDICTION_LOAD_BFF_URL)) {
        $env:PREDICTION_LOAD_BFF_URL = 'http://localhost:3006'
    }
    if ([string]::IsNullOrWhiteSpace($env:PREDICTION_LOAD_DASHBOARD_URL)) {
        $env:PREDICTION_LOAD_DASHBOARD_URL = 'http://localhost:3004'
    }
    $env:PREDICTION_LOAD_API_URL = 'http://localhost:18007'
    $env:PREDICTION_LOAD_PROGRAM_REF = $ProgramRef
    $env:PREDICTION_LOAD_CUT_ID = $CutId
    $env:PREDICTION_LOAD_SUBJECT_REF = $selectedSubjectRef
    $env:PREDICTION_LOAD_COMPOSE_PROJECT = $project
    $env:PREDICTION_LOAD_COMPOSE_FILE = $composeFile
    $env:PREDICTION_LOAD_COMPOSE_SERVICES = 'prediction-e2e-api,prediction-e2e-worker,prediction-e2e-rabbitmq'
    $env:PREDICTION_LOAD_COMPOSE_API_SERVICE = 'prediction-e2e-api'
    $env:PREDICTION_LOAD_COMPOSE_WORKER_SERVICE = 'prediction-e2e-worker'
    if ($InjectWorkerCrash) {
        $env:PRED008_CONFIRM_WORKER_CRASH = 'true'
    } else {
        Remove-Item Env:PRED008_CONFIRM_WORKER_CRASH -ErrorAction SilentlyContinue
    }

    $runnerParameters = @{
        ConfirmDevelopment = $true
        DurationSeconds = $DurationSeconds
        Clients = $Clients
        Output = $Output
    }
    if ($Enforce) {
        if (-not $PSBoundParameters.ContainsKey('MaxP95Regression') -or
            -not $PSBoundParameters.ContainsKey('MaxErrorRate')) {
            throw '-Enforce requires explicit -MaxP95Regression and -MaxErrorRate values.'
        }
        $runnerParameters.Enforce = $true
        $runnerParameters.MaxP95Regression = $MaxP95Regression
        $runnerParameters.MaxErrorRate = $MaxErrorRate
    }
    if ($InjectWorkerCrash) { $runnerParameters.InjectWorkerCrash = $true }
    Write-Host 'Running the authenticated load characterization against the isolated model bundle…'
    & $pythonRunner @runnerParameters
    if ($LASTEXITCODE -ne 0) { throw "PRED-008 characterization failed with exit code $LASTEXITCODE." }
} catch {
    throw
} finally {
    if ($isolatedProjectCreated) {
        Write-Host "Removing only this run's Compose project and test artifact volume…"
        & docker compose @composeArgs down --volumes --remove-orphans
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Isolated Compose cleanup reported an error.' }
    }
    if ($displacedApiContainerId) {
        Write-Host 'Restoring the PRED-007 E2E API that previously owned localhost:18007…'
        & docker start $displacedApiContainerId | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Could not automatically restart the previous PRED-007 E2E API container.' }
    }
    if ($sessionCookieAddedByPrompt) {
        Remove-Item Env:PREDICTION_LOAD_SESSION_COOKIE -ErrorAction SilentlyContinue
    }
    Pop-Location
}
