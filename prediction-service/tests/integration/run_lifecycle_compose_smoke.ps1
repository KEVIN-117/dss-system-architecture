param(
    [int]$Port = 18135
)

$ErrorActionPreference = "Stop"
$composeFile = Join-Path $PSScriptRoot "..\..\docker-compose.lifecycle-smoke.yml"
$projectName = "pred005-smoke-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$composeArgs = @("compose", "-p", $projectName, "-f", $composeFile)
$env:PREDICTION_SMOKE_PORT = "$Port"
$modelId = "compose-smoke-model"
$modelVersion = "smoke-v1"
$started = $false

function Invoke-SmokeCompose([string[]]$Arguments) {
    $dockerArguments = $composeArgs + $Arguments
    & docker @dockerArguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

try {
    Invoke-SmokeCompose @("build", "api", "worker")
    $started = $true
    Invoke-SmokeCompose @("up", "-d", "rabbitmq", "api", "worker")

    $deadline = (Get-Date).AddMinutes(3)
    do {
        $status = (& docker @composeArgs ps --status running --services 2>$null) -join "`n"
        if ($LASTEXITCODE -eq 0 -and $status -match "api" -and $status -match "worker" -and $status -match "rabbitmq") {
            try {
                Invoke-RestMethod -Uri "http://127.0.0.1:$Port/" -TimeoutSec 3 | Out-Null
                break
            } catch {
                Start-Sleep -Seconds 2
            }
        } else {
            Start-Sleep -Seconds 2
        }
        if ((Get-Date) -ge $deadline) {
            throw "Prediction API did not become ready within three minutes."
        }
    } while ($true)

    $seedArgs = $composeArgs + @("run", "--rm", "--no-deps", "worker", "python", "/app/tests/integration/seed_registry_lifecycle_smoke.py")
    $seedOutput = & docker @seedArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Could not prepare the isolated lifecycle smoke bundle."
    }
    $seed = ($seedOutput | Select-Object -Last 1) | ConvertFrom-Json
    if ($seed.model_id -ne $modelId -or $seed.version -ne $modelVersion -or -not $seed.artifact_digest) {
        throw "The isolated lifecycle smoke bundle was not created as expected."
    }
    Invoke-SmokeCompose @("restart", "api")

    $deadline = (Get-Date).AddMinutes(2)
    do {
        try {
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/predict" `
                -Method Post -ContentType "application/json" -Body "{}" `
                -SkipHttpErrorCheck -TimeoutSec 5
            $payload = $response.Content | ConvertFrom-Json
            if ($response.StatusCode -eq 503 -and
                $payload.detail.code -eq "TRUSTED_FEATURE_SOURCE_UNAVAILABLE" -and
                $payload.detail.model_id -eq $modelId -and
                $payload.detail.model_version -eq $modelVersion) {
                Write-Host "PASS: API reloaded the same complete model bundle after container restart."
                break
            }
            throw "Unexpected /predict response after restart: $($response.Content)"
        } catch {
            if ((Get-Date) -ge $deadline) { throw }
            Start-Sleep -Seconds 2
        }
    } while ($true)

    $digestCommand = "from pathlib import Path; from training.model_registry import ModelRegistry; print(ModelRegistry(Path('/app/artifacts')).active().digest)"
    $workerArgs = $composeArgs + @("exec", "-T", "worker", "python", "-c", $digestCommand)
    $workerDigest = (& docker @workerArgs).Trim()
    if ($LASTEXITCODE -ne 0 -or $workerDigest -ne $seed.artifact_digest) {
        throw "Worker did not read the expected active model from the shared artifacts volume."
    }
    $apiArgs = $composeArgs + @("exec", "-T", "api", "python", "-c", $digestCommand)
    $apiDigest = (& docker @apiArgs).Trim()
    if ($LASTEXITCODE -ne 0 -or $apiDigest -ne $seed.artifact_digest) {
        throw "API did not read the expected active model from the shared artifacts volume after restart."
    }

    Write-Host "PASS: API and worker read the active bundle from the shared named volume."
    Write-Host "PASS: active pointer and model bundle survived API container restart."
} finally {
    if ($started) {
        Invoke-SmokeCompose @("down", "--volumes", "--remove-orphans")
    }
}
