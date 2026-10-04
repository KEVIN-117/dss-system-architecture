$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$composeFile = Join-Path $repoRoot 'infra\dw-integration\dw-integration-test.yml'

function Invoke-Compose {
    param([string[]]$ComposeArgs)
    & docker compose -f $composeFile @ComposeArgs
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed with exit code ${LASTEXITCODE}: $($ComposeArgs -join ' ')"
    }
}

Write-Host 'Starting isolated synthetic OLTP and DW fixtures'
Invoke-Compose @('up', '-d', 'jachasun-fixture', 'postgres-dw')

Write-Host 'Applying migrations and preparing the restricted Hop test login'
Invoke-Compose @('run', '--rm', 'integration-test')

Write-Host 'Running Hop workflow: control -> source contract -> manifest/metric -> safe non-publication'
Invoke-Compose @('--profile', 'dw-vertical', 'run', '--rm', '--no-deps', 'hop-vertical-integration-test')

Write-Host 'Asserting execution audit, read-only boundary, and absence of DW publication'
Invoke-Compose @('--profile', 'dw-vertical', 'run', '--rm', '--no-deps', 'hop-vertical-assert')

Write-Host 'Vertical smoke passed. Fixture containers remain available for inspection.'
