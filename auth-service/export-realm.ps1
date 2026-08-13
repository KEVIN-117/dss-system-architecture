<#
.SYNOPSIS
    Exporta la configuración del Realm de Keycloak mediante la API de Administración.
.DESCRIPTION
    Este script obtiene un token de administrador para el cliente 'admin-cli' y realiza una
    exportación parcial (incluyendo clientes y roles) del Realm especificado. El resultado
    se guarda en formato JSON compatible con el mecanismo de importación de Keycloak.
.PARAMETER KeycloakUrl
    URL base del servidor de Keycloak. Por defecto 'http://localhost:8080'.
.PARAMETER AdminUser
    Nombre de usuario del administrador de Keycloak. Por defecto 'kerbero'.
.PARAMETER AdminPassword
    Contraseña del administrador de Keycloak. Por defecto 'jFeCD7'.
.PARAMETER RealmName
    Nombre del Realm que se desea exportar. Por defecto 'uatf-dss-realm'.
.PARAMETER OutputPath
    Ruta relativa o absoluta donde se guardará el archivo JSON exportado. Por defecto '../infra/keycloak/realm/uatf-realm-realm.json'.
.EXAMPLE
    .\export-realm.ps1
.EXAMPLE
    .\export-realm.ps1 -AdminUser "admin" -AdminPassword "password" -RealmName "my-realm"
#>

param (
    [string]$KeycloakUrl = "http://localhost:8080",
    [string]$AdminUser = "kerbero",
    [string]$AdminPassword = "jFeCD7",
    [string]$RealmName = "uatf-dss-realm",
    [string]$OutputPath = "$PSScriptRoot/../infra/keycloak/realm/uatf-dss-realm-realm.json"
)

$ErrorActionPreference = "Stop"

Write-Host "========== Iniciando Exportación de Keycloak ==========" -ForegroundColor Cyan
Write-Host "Servidor: $KeycloakUrl"
Write-Host "Realm a exportar: $RealmName"
Write-Host "Destino: $OutputPath"

try {
    # 1. Obtener Token de Acceso
    Write-Host "`n[1/2] Solicitando token de acceso administrativo..." -ForegroundColor Yellow
    $tokenUrl = "$KeycloakUrl/realms/master/protocol/openid-connect/token"
    $tokenBody = @{
        grant_type = "password"
        client_id  = "admin-cli"
        username   = $AdminUser
        password   = $AdminPassword
    }

    $tokenResponse = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $tokenBody
    $accessToken = $tokenResponse.access_token
    Write-Host "✔ Token obtenido exitosamente." -ForegroundColor Green

    # 2. Ejecutar Exportación Parcial
    Write-Host "`n[2/2] Exportando configuración del Realm (roles y clientes)..." -ForegroundColor Yellow
    $exportUrl = "$KeycloakUrl/admin/realms/$RealmName/partial-export?exportGroupsAndRoles=true&exportClients=true"
    $headers = @{
        Authorization = "Bearer $accessToken"
    }

    $exportedJson = Invoke-RestMethod -Uri $exportUrl -Method Post -Headers $headers

    # 3. Guardar el archivo JSON
    # Asegurar que el directorio de salida existe
    $directory = Split-Path -Path $OutputPath
    if (-not (Test-Path -Path $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    # Convertir a JSON formateado y guardar con UTF-8
    $jsonString = $exportedJson | ConvertTo-Json -Depth 100
    $jsonString | Out-File -FilePath $OutputPath -Encoding utf8

    Write-Host "`n✔ ¡Exportación completada con éxito!" -ForegroundColor Green
    Write-Host "Archivo guardado en: $OutputPath" -ForegroundColor Green
    Write-Host "=======================================================" -ForegroundColor Cyan

} catch {
    Write-Error "Ocurrió un error durante la exportación de Keycloak: $_"
    exit 1
}
