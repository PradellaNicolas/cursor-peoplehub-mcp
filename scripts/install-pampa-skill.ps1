#Requires -Version 5.1
<#
.SYNOPSIS
  Instala o actualiza el skill pampa-timereport-diario en Cursor desde este repo.
.EXAMPLE
  .\scripts\install-pampa-skill.ps1
.EXAMPLE
  .\scripts\install-pampa-skill.ps1 -Force
#>
param(
  [switch] $Force
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot 'skills\pampa-timereport-diario'
$destParent = Join-Path $env:USERPROFILE '.cursor\skills'
$dest = Join-Path $destParent 'pampa-timereport-diario'

if (-not (Test-Path $source)) {
  Write-Error "No se encuentra el skill en el repo: $source"
}

if ((Test-Path $dest) -and -not $Force) {
  Write-Host "Ya existe: $dest"
  Write-Host "Usá -Force para sobrescribir tras un git pull, o borrá la carpeta manualmente."
  exit 1
}

New-Item -ItemType Directory -Force -Path $destParent | Out-Null
if (Test-Path $dest) {
  Remove-Item -Recurse -Force $dest
}
Copy-Item -Recurse -Force $source $destParent
Write-Host "Skill instalado en: $dest"
Write-Host "Siguiente: copiá plantilla-perfil.yaml a $env:USERPROFILE\.pampa-timereport.yaml y completá tu AST."
