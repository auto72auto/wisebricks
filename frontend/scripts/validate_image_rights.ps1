param(
  [switch]$MonetizedMode
)

$root = Split-Path -Parent $PSScriptRoot
$registerPath = Join-Path $root 'image_rights_register.csv'

if (-not (Test-Path $registerPath)) {
  Write-Error "Missing register: $registerPath"
  exit 1
}

$rows = Import-Csv $registerPath
$byPath = @{}
foreach ($row in $rows) {
  $byPath[$row.image_path] = $row
}

$missing = @()
$untagged = @()
$blocked = @()

$htmlFiles = Get-ChildItem -Path $root -Recurse -File -Filter *.html
foreach ($file in $htmlFiles) {
  $content = Get-Content -Raw $file.FullName
  $imgMatches = [regex]::Matches($content, '<img[^>]*set-images/[^>]*>', 'IgnoreCase')

  foreach ($m in $imgMatches) {
    $tag = $m.Value

    $src = $null
    if ($tag -match "src\s*=\s*'([^']+)'") {
      $src = $Matches[1]
    } elseif ($tag -match 'src\s*=\s*"([^"]+)"') {
      $src = $Matches[1]
    }

    if (-not $src) { continue }

    $src = $src.TrimStart('.')
    $src = $src.TrimStart('/')

    if (-not $byPath.ContainsKey($src)) {
      $missing += "Missing register entry: $src (in $($file.Name))"
    }

    $hasRightsStatus = $false
    if ($tag -match "data-rights-status\s*=\s*'temporary_non_commercial'") { $hasRightsStatus = $true }
    if ($tag -match 'data-rights-status\s*=\s*"temporary_non_commercial"') { $hasRightsStatus = $true }

    if (-not $hasRightsStatus) {
      $untagged += "Missing/invalid data-rights-status on $src (in $($file.Name))"
    }

    if ($MonetizedMode -and $byPath.ContainsKey($src)) {
      if ($byPath[$src].publish_status -eq 'rights_unknown_commercial') {
        $blocked += "Blocked in monetized mode: $src (in $($file.Name))"
      }
    }
  }
}

if ($missing.Count -gt 0) { $missing | ForEach-Object { Write-Host $_ } }
if ($untagged.Count -gt 0) { $untagged | ForEach-Object { Write-Host $_ } }
if ($blocked.Count -gt 0) { $blocked | ForEach-Object { Write-Host $_ } }

if ($missing.Count -gt 0 -or $untagged.Count -gt 0 -or $blocked.Count -gt 0) {
  Write-Error 'Image rights validation failed.'
  exit 1
}

Write-Host 'Image rights validation passed.'
