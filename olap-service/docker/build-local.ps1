param()

$ErrorActionPreference = 'Stop'
$olapRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $olapRoot
$composeFile = Join-Path $repoRoot 'docker-compose.yml'

Push-Location $olapRoot
try {
    Write-Host 'Checking Java formatting with Spotless across all Java source modules...'
    # The BOM is a sibling POM without the Saiku parent/plugin; exclude it and
    # select every source-bearing reactor module explicitly.
    $spotlessProjects = 'saiku-core/saiku-olap-util,saiku-core/saiku-semantic,saiku-core/saiku-service,saiku-core/saiku-sql,saiku-core/saiku-web,saiku-api,saiku-launcher,saiku-proptest'
    & mvn -B -ntp -pl $spotlessProjects com.diffplug.spotless:spotless-maven-plugin:3.9.0:check
    if ($LASTEXITCODE -ne 0) {
        throw "Spotless check failed with exit code $LASTEXITCODE. Fix formatting before building the Docker image."
    }

    Write-Host 'Building and verifying the OLAP launcher JAR...'
    & mvn -B -ntp -pl saiku-launcher -am verify
    if ($LASTEXITCODE -ne 0) {
        throw "Maven verify failed with exit code $LASTEXITCODE. The Docker image was not built."
    }

    $launcherJar = Get-ChildItem -Path 'saiku-launcher/target' -Filter 'saiku-*.jar' -File |
        Where-Object { $_.Name -notmatch '(sources|javadoc|original)' } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($null -eq $launcherJar) {
        throw 'Maven completed without producing saiku-launcher/target/saiku-<version>.jar.'
    }

    $buildContext = Join-Path $olapRoot 'build-context'
    New-Item -ItemType Directory -Path $buildContext -Force | Out-Null
    Copy-Item -LiteralPath $launcherJar.FullName -Destination (Join-Path $buildContext 'saiku.jar') -Force

    Write-Host "Building dss-olap-service:local from $($launcherJar.Name)..."
    & docker compose -f $composeFile build olap-service
    if ($LASTEXITCODE -ne 0) {
        throw "Docker image build failed with exit code $LASTEXITCODE."
    }

    Write-Host 'Image ready. Start it with: docker compose up -d olap-service'
}
finally {
    Pop-Location
}
