[CmdletBinding()]
param(
  [ValidateSet('Inspect','AdoptLegacy','PrepareNext','SeedOld','Upgrade','VerifyNew','Uninstall')][string]$Action = 'Inspect',
  [string]$RepoRoot,
  [string]$InstallDirectory,
  [string]$DataDirectory,
  [string]$RunDirectory,
  [string]$Installer,
  [string]$ReferenceDirectory,
  [string]$OldVersion,
  [string]$TargetVersion,
  [string]$Marker,
  [string]$Node = 'node',
  [switch]$ConfirmLegacyFixture,
  [switch]$AllowUninstall
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ([string]::IsNullOrWhiteSpace($RepoRoot)) { $RepoRoot = Split-Path -Path $PSScriptRoot -Parent }
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
if ($env:OS -ne 'Windows_NT') { throw 'Windows only. This script never provisions a general installation.' }
$runner = Join-Path $PSScriptRoot 'desktop-upgrade.mjs'
if (!(Test-Path -LiteralPath $runner -PathType Leaf)) { throw 'Node companion missing.' }
function FullPath([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { throw 'All fixture/artifact paths are required.' }
  $full = [IO.Path]::GetFullPath($value).TrimEnd('\')
  if ($full -notmatch '^[A-Za-z]:\\' -or $full.Substring(2).Contains(':')) { throw "Only a local drive path without alternate streams is allowed: $value" }
  return $full
}
function SamePath([string]$a,[string]$b) { return [string]::Equals((FullPath $a),(FullPath $b),[StringComparison]::OrdinalIgnoreCase) }
function Under([string]$parent,[string]$child) { return (FullPath $child).StartsWith((FullPath $parent)+'\',[StringComparison]::OrdinalIgnoreCase) }
function NoReparse([string]$value,[bool]$mayBeMissing=$false) {
  $path = FullPath $value
  if (!(Test-Path -LiteralPath $path)) { if (!$mayBeMissing) { throw "Required path missing: $path" }; $path=Split-Path $path -Parent }
  while ($path) {
    $item=Get-Item -LiteralPath $path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse point rejected: $path" }
    $parent=Split-Path $path -Parent
    if (!$parent -or $parent -eq $path) { break }
    $path=$parent
  }
}
function NoRicamoProcesses {
  $processes=@(Get-CimInstance Win32_Process -Filter "Name = 'Ricamo.exe'" -ErrorAction Stop)
  if ($processes.Count -ne 0) { throw 'A Ricamo process is open. Close it explicitly; this harness never kills applications.' }
}
function Entries {
  return @(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction Stop | Where-Object { $_.PSObject.Properties['DisplayName'] -and $_.DisplayName -match '^Ricamo(?:$| )' })
}
function Registration([string]$version) {
  $entries=@(Entries)
  if ($entries.Count -ne 1) { throw 'Exactly one current-user Ricamo uninstall entry is required.' }
  $entry=$entries[0]
  $match=[regex]::Match([string]$entry.UninstallString,'^"([^"\r\n]+)"\s+/currentuser\s*$',[Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if (!$match.Success) { throw 'Unexpected uninstaller syntax; never execute an arbitrary uninstall command.' }
  $uninstaller=$match.Groups[1].Value
  if ([IO.Path]::GetFileName($uninstaller) -ne 'Uninstall Ricamo.exe' -or !(SamePath (Split-Path $uninstaller -Parent) $config.installDir)) { throw 'Uninstall entry is not the exact marked test installation.' }
  if ([string]$entry.DisplayVersion -ne $version) { throw 'Registry version differs from the requested phase.' }
  $location=if ($entry.PSObject.Properties['InstallLocation']) { [string]$entry.InstallLocation } else { '' }
  if ($location -and !(SamePath $location $config.installDir)) { throw 'InstallLocation disagrees with the test folder.' }
  $key=(Get-Item -LiteralPath $entry.PSPath).Name
  if ($script:record -and $key -ne $script:record.registry.key) { throw 'Uninstall registry key changed.' }
  return [pscustomobject]@{key=$key;name=[string]$entry.DisplayName;version=[string]$entry.DisplayVersion;uninstall=[string]$entry.UninstallString;location=$location;executable=$uninstaller}
}
function Shortcuts {
  $roots=@(
    @{path=[Environment]::GetFolderPath('Desktop');recursive=$false},
    @{path=[Environment]::GetFolderPath('CommonDesktopDirectory');recursive=$false},
    @{path=[Environment]::GetFolderPath('StartMenu');recursive=$true},
    @{path=[Environment]::GetFolderPath('CommonStartMenu');recursive=$true}
  ) | Where-Object { $_.path -and (Test-Path -LiteralPath $_.path) }
  $shell=New-Object -ComObject WScript.Shell
  $found=@()
  try {
    foreach ($root in $roots) {
      foreach ($file in @(Get-ChildItem -LiteralPath $root.path -Filter '*.lnk' -File -Recurse:$root.recursive -ErrorAction Stop)) {
        $shortcut=$shell.CreateShortcut($file.FullName)
        $target=[string]$shortcut.TargetPath
        if ($file.BaseName -match '^Ricamo(?:$| )' -or ($target -and [IO.Path]::GetFileName($target) -eq 'Ricamo.exe')) {
          if (!(SamePath $target (Join-Path $config.installDir 'Ricamo.exe'))) { throw 'A Ricamo shortcut targets a different installation; preserve it and inspect manually.' }
          $found += [pscustomobject]@{path=$file.FullName;target=$target;arguments=[string]$shortcut.Arguments;workingDirectory=[string]$shortcut.WorkingDirectory}
        }
      }
    }
  } finally { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell) }
  return @($found | Sort-Object path -Unique)
}
function InvokeRunner([string]$phase,[object]$extra) {
  $inputObject=@{config=$config}
  foreach ($key in $extra.Keys) { $inputObject[$key]=$extra[$key] }
  $encoded=[Convert]::ToBase64String($utf8.GetBytes(($inputObject | ConvertTo-Json -Depth 30 -Compress)))
  $arguments=@(('"'+$runner+'"'),'--phase',$phase,'--input',$encoded)
  if ($Marker) { $arguments+=@('--marker',('"'+$Marker+'"')) }
  $nodeExecutable=(Get-Command -Name $Node -CommandType Application -ErrorAction Stop).Source
  $process=Start-Process -FilePath $nodeExecutable -ArgumentList $arguments -NoNewWindow -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Node phase $phase failed ($($process.ExitCode)); no later phase was run." }
}
$script:record=$null
if ($Action -in @('Inspect','AdoptLegacy')) {
  if ($Marker) { throw 'Inspect/adoption require explicit fixture paths, not a previous marker.' }
  $config=[pscustomobject]@{repoRoot=(FullPath $RepoRoot);installDir=(FullPath $InstallDirectory);dataDir=(FullPath $DataDirectory);runDir=(FullPath $RunDirectory);installer=(FullPath $Installer);referenceDir=(FullPath $ReferenceDirectory);oldVersion=$OldVersion;targetVersion=$TargetVersion;legacyEvidence=(Join-Path (FullPath $DataDirectory) 'result.json')}
} else {
  if (!$Marker) { throw 'A validated test marker is required.' }
  NoReparse $Marker
  $script:record=Get-Content -LiteralPath $Marker -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($record.kind -ne 'ricamo-installed-upgrade-fixture' -or $record.format -ne 1) { throw 'Unknown marker format.' }
  $config=$record.config
  if (!(SamePath $Marker (Join-Path $config.runDir 'marker.json'))) { throw 'Marker must remain in its recorded run folder.' }
}
$runtime=Join-Path (FullPath $config.repoRoot) '.runtime'
foreach ($key in @('installDir','dataDir','runDir')) { if (!(Under $runtime $config.$key)) { throw "$key must be strictly below repository .runtime" }; NoReparse $config.$key ($key -eq 'runDir') }
foreach ($pair in @(@('installDir','dataDir'),@('installDir','runDir'),@('dataDir','runDir'))) { if ((SamePath $config.($pair[0]) $config.($pair[1])) -or (Under $config.($pair[0]) $config.($pair[1])) -or (Under $config.($pair[1]) $config.($pair[0]))) { throw 'Install/profile/proof folders must be disjoint.' } }
NoRicamoProcesses
switch ($Action) {
  'Inspect' { $registration=Registration $config.oldVersion; InvokeRunner 'inspect' @{registry=$registration;shortcuts=@(Shortcuts)} }
  'AdoptLegacy' {
    if (!$ConfirmLegacyFixture) { throw 'Use -ConfirmLegacyFixture only after reviewing Inspect; adoption is explicit.' }
    if (Test-Path -LiteralPath $config.runDir) { throw 'Never put a marker over an existing/unknown run directory.' }
    $registration=Registration $config.oldVersion; InvokeRunner 'adopt' @{registry=$registration;shortcuts=@(Shortcuts);adoptLegacy=$true}
  }
  'PrepareNext' {
    if ($record.phase -ne 'verified') { throw 'Only a completed VerifyNew proof can be continued.' }
    $nextConfig=[pscustomobject]@{repoRoot=$config.repoRoot;installDir=$config.installDir;dataDir=$config.dataDir;runDir=(FullPath $RunDirectory);installer=(FullPath $Installer);referenceDir=(FullPath $ReferenceDirectory);oldVersion=$config.targetVersion;targetVersion=$TargetVersion;legacyEvidence=$config.legacyEvidence}
    if ($OldVersion -and $OldVersion -ne $nextConfig.oldVersion) { throw 'OldVersion must equal the previously verified target.' }
    $registration=Registration $config.targetVersion
    InvokeRunner 'prepare-next' @{registry=$registration;shortcuts=@(Shortcuts);nextConfig=$nextConfig}
  }
  'SeedOld' { $registration=Registration $config.oldVersion; InvokeRunner 'seed-old' @{registry=$registration} }
  'Upgrade' {
    $registration=Registration $config.oldVersion; InvokeRunner 'check-before' @{registry=$registration}
    NoRicamoProcesses
    NoReparse $config.installer
    # NSIS /D= is deliberately the final argument: its remaining text is the target path.
    $process=Start-Process -FilePath $config.installer -ArgumentList @('/S','--keep-shortcuts','--no-desktop-shortcut',('/D='+$config.installDir)) -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
    NoRicamoProcesses
    $registration=Registration $config.targetVersion
    InvokeRunner 'record-upgrade' @{registry=$registration;shortcuts=@(Shortcuts);installerExitCode=[int]$process.ExitCode}
  }
  'VerifyNew' { $registration=Registration $config.targetVersion; InvokeRunner 'verify-new' @{registry=$registration} }
  'Uninstall' {
    if (!$AllowUninstall) { throw 'Uninstall is an explicit optional phase; -AllowUninstall is required.' }
    $registration=Registration $config.targetVersion; InvokeRunner 'check-uninstall' @{registry=$registration}
    $links=@(Shortcuts); NoRicamoProcesses; NoReparse $registration.executable
    # Parse/validate the executable above; never Invoke-Expression the registry string.
    $process=Start-Process -FilePath $registration.executable -ArgumentList @('/S','/currentuser') -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Uninstaller failed: $($process.ExitCode)" }
    $deadline=[DateTime]::UtcNow.AddSeconds(45)
    do {
      $entryRemaining=@(Entries).Count -ne 0
      $appRemaining=(Test-Path -LiteralPath (Join-Path $config.installDir 'Ricamo.exe')) -or (Test-Path -LiteralPath (Join-Path $config.installDir 'resources\app.asar'))
      $linksRemaining=@($links | Where-Object { Test-Path -LiteralPath $_.path }).Count -ne 0
      if (!$entryRemaining -and !$appRemaining -and !$linksRemaining) { break }
      Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    if ($entryRemaining -or $appRemaining -or $linksRemaining) { throw 'Uninstall did not remove every tested app/registry/shortcut entry; no manual cleanup is attempted.' }
    NoRicamoProcesses
    if (@(Shortcuts).Count -ne 0) { throw 'Unexpected remaining Ricamo shortcuts.' }
    InvokeRunner 'record-uninstall' @{uninstallerExitCode=[int]$process.ExitCode;registryRemoved=$true;shortcutsRemoved=$true}
  }
}
