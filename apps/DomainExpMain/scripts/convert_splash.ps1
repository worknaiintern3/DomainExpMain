Add-Type -AssemblyName System.Drawing
$inPath = (Resolve-Path "assets\images\splash-bg.png").Path
$outPath = (Join-Path (Get-Location) "assets\images\splash-bg-valid.png")
$bmp = [System.Drawing.Bitmap]::FromFile($inPath)
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Move-Item -Force $outPath $inPath
Write-Host "SUCCESSFULLY_CONVERTED_TO_PNG"
