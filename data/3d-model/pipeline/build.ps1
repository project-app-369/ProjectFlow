$ErrorActionPreference = 'Stop'
$nw  = 'C:\Program Files\Autodesk\Navisworks Manage 2025'
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$out = Join-Path $PSScriptRoot 'bin'
New-Item -ItemType Directory -Force $out | Out-Null
$refs = @("$nw\Autodesk.Navisworks.Api.dll", "$nw\Autodesk.Navisworks.Interop.ComApi.dll", "$nw\Autodesk.Navisworks.ComApi.dll", 'System.Core.dll') | ForEach-Object { "/r:$_" }
$dll = "$out\ModelTool.dll"

& $csc /nologo /target:library /platform:x64 /out:$dll @refs "$PSScriptRoot\ModelTool.cs" "$PSScriptRoot\Extract.cs" | Where-Object { $_ -notmatch 'warning' }
if ($LASTEXITCODE) { throw 'ModelTool build failed' }

# Windows Smart App Control / App Control for Business refuses unsigned DLLs it has no reputation for, and Navisworks cannot
# load the plugin then ("The Plugin was not found"). Sign the DLL with a trusted code-signing certificate, or have the machine's
# owner allow it in their application-control policy; do not rebuild in a loop to get past the block.
try { [void][Reflection.Assembly]::LoadFrom($dll) } catch {
  throw "Windows application control blocked $dll ($($_.Exception.Message)). Sign it or allow it in the application-control policy, then run again."
}
Write-Host "built $dll"
