# Update the existing static export while Next.js dependencies are unavailable locally.
$outDir = Join-Path $PSScriptRoot '..\apps\landing\out'
if (-not (Test-Path -LiteralPath $outDir)) {
  throw "Landing static export is missing: $outDir"
}
$files = Get-ChildItem -LiteralPath $outDir -Recurse -File | Where-Object { $_.Extension -in '.html', '.js' }
$changed = 0
foreach ($file in $files) {
  $text = [System.IO.File]::ReadAllText($file.FullName)
  $updated = $text
  foreach ($path in @('/login', '/register', '/find-domain', '/pricing', '/domains', '/overview', '/settings', '/security', '/google-play')) {
    $updated = $updated.Replace("https://domainexp.info$path", "http://localhost:5173$path")
    $updated = $updated.Replace("https://domainexp.info$path", "http://localhost:5173$path")
  }
  # Also replace the APP_URL in the JavaScript bundles
  $updated = $updated.Replace('"https://domainexp.info"', '"http://localhost:5173"')
  $updated = $updated.Replace("'https://domainexp.info'", "'http://localhost:5173'")
  if ($updated -ne $text) {
    [System.IO.File]::WriteAllText($file.FullName, $updated, [System.Text.UTF8Encoding]::new($false))
    $changed++
  }
}
Write-Output "Updated $changed landing export files for localhost links."
