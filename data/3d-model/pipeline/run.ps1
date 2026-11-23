# Usage: .\run.ps1 <model.nwd> <batch-command-file>   (rebuilds the plugin first)
# Drives Navisworks through its Automation DLL from PowerShell (no unsigned exe to trip App Control).
param([Parameter(Mandatory)][string]$Model, [Parameter(Mandatory)][string]$Cmds)
$ErrorActionPreference = 'Stop'
$nw = 'C:\Program Files\Autodesk\Navisworks Manage 2027'
& "$PSScriptRoot\build.ps1"
New-Item -ItemType Directory -Force "$PSScriptRoot\out" | Out-Null
$env:Path += ";$nw"
Add-Type -Path "$nw\Autodesk.Navisworks.Automation.dll"
$sw = [Diagnostics.Stopwatch]::StartNew()
$app = New-Object Autodesk.Navisworks.Api.Automation.NavisworksApplication
try {
  $app.Visible = $false
  $app.DisableProgress()
  $app.OpenFile($Model)
  $dllName = if ($env:MODELTOOL_DLL) { $env:MODELTOOL_DLL } else { 'ModelTool.dll' }
  $app.AddPluginAssembly("$PSScriptRoot\bin\$dllName")
  $rc = $app.ExecuteAddInPlugin('ModelTool.PRJF', [string[]]@('batch', (Resolve-Path $Cmds).Path))
  "plugin rc=$rc"
} finally { $app.Dispose() }
"elapsed $($sw.Elapsed)"
Get-ChildItem "$PSScriptRoot\*.err" -ErrorAction SilentlyContinue | ForEach-Object { "ERROR FILE $_"; Get-Content $_ }
