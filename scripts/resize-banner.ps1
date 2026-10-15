Add-Type -AssemblyName System.Drawing

$sourcePath = 'C:\Users\Admin\.gemini\antigravity-ide\brain\865791b9-73d8-42f1-97bd-a33bbdf6f285\play_feature_banner_1791356215675.jpg'
$destPath = Join-Path (Resolve-Path 'apps\DomainExpMain\assets\play-store').Path 'feature_graphic_1024x500.jpg'

$src = [System.Drawing.Image]::FromFile($sourcePath)
Write-Host "Source dimensions: $($src.Width)x$($src.Height)"

$targetW = 1024
$targetH = 500

$dest = New-Object System.Drawing.Bitmap($targetW, $targetH)
$graph = [System.Drawing.Graphics]::FromImage($dest)

$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$srcRatio = $src.Width / $src.Height
$targetRatio = $targetW / $targetH

if ($srcRatio -gt $targetRatio) {
    $cropW = [int]($src.Height * $targetRatio)
    $cropH = $src.Height
    $cropX = [int](($src.Width - $cropW) / 2)
    $cropY = 0
} else {
    $cropW = $src.Width
    $cropH = [int]($src.Width / $targetRatio)
    $cropX = 0
    $cropY = [int](($src.Height - $cropH) / 2)
}

$srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
$destRect = New-Object System.Drawing.Rectangle(0, 0, $targetW, $targetH)

$graph.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]95)

$dest.Save($destPath, $codec, $encoderParams)

# Also save a copy in the artifacts directory for quick access
$artifactCopy = 'C:\Users\Admin\.gemini\antigravity-ide\brain\865791b9-73d8-42f1-97bd-a33bbdf6f285\feature_graphic_1024x500.jpg'
$dest.Save($artifactCopy, $codec, $encoderParams)

$graph.Dispose()
$dest.Dispose()
$src.Dispose()

Write-Host "SUCCESS: Created 1024x500 Feature Graphic at $destPath and $artifactCopy"
