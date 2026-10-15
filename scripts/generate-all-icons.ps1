Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\Admin\.gemini\antigravity-ide\brain\269d916a-ca08-487c-a53b-278b52683481\.user_uploaded\media_1791875982412.jpg"
$baseDir = "E:\DomainlPulse\Domainpulse"

if (-not (Test-Path $sourcePath)) {
    Write-Error "Source image not found at $sourcePath"
    exit 1
}

# Helper to save bitmap as true PNG
function Save-Png([System.Drawing.Bitmap]$bmp, [string]$destPath) {
    $dir = [System.IO.Path]::GetDirectoryName($destPath)
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    
    # Save to memory stream first to avoid file lock issues
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    [System.IO.File]::WriteAllBytes($destPath, $ms.ToArray())
    $ms.Dispose()
    
    # Verify header: 89 50 4E 47
    $bytes = [System.IO.File]::ReadAllBytes($destPath)
    if ($bytes.Length -ge 4 -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50 -and $bytes[2] -eq 0x4E -and $bytes[3] -eq 0x47) {
        Write-Host "  [OK] Saved TRUE PNG: $destPath ($($bmp.Width)x$($bmp.Height), $($bytes.Length) bytes)"
    } else {
        Write-Error "  [FAILED] Not a valid PNG: $destPath"
    }
}

# Helper to resize image with high quality
function Resize-Image([System.Drawing.Image]$src, [int]$targetW, [int]$targetH) {
    $destBmp = New-Object System.Drawing.Bitmap($targetW, $targetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::FromArgb(0, 4, 15))
    $g.DrawImage($src, 0, 0, $targetW, $targetH)
    $g.Dispose()
    return $destBmp
}

# 1. Load source image
$srcBytes = [System.IO.File]::ReadAllBytes($sourcePath)
$msIn = New-Object System.IO.MemoryStream(,$srcBytes)
$srcImg = [System.Drawing.Image]::FromStream($msIn)

Write-Host "Processing source image: $($srcImg.Width)x$($srcImg.Height)"

# 2. Master 1024x1024 PNG
$master1024 = Resize-Image $srcImg 1024 1024
Save-Png $master1024 "$baseDir\apps\DomainExpMain\assets\images\master-icon.png"
Save-Png $master1024 "$baseDir\apps\DomainExpMain\assets\images\icon.png"
Save-Png $master1024 "$baseDir\apps\DomainExpMain\assets\images\splash-icon.png"
Save-Png $master1024 "$baseDir\apps\web\public\logo.png"

# 3. 512x512 PNG for Google Play Store & Web
$icon512 = Resize-Image $srcImg 512 512
Save-Png $icon512 "$baseDir\apps\DomainExpMain\assets\play-store\play_store_icon_512x512.png"
Save-Png $icon512 "$baseDir\apps\DomainExpMain\assets\images\favicon.png"
Save-Png $icon512 "$baseDir\apps\web\public\favicon.png"
$icon512.Dispose()

# 4. Android Adaptive Icon Foreground (1024x1024 canvas with content scaled safely to 72% center zone)
$adaptiveBmp = New-Object System.Drawing.Bitmap(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gAdaptive = [System.Drawing.Graphics]::FromImage($adaptiveBmp)
$gAdaptive.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gAdaptive.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gAdaptive.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gAdaptive.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$gAdaptive.Clear([System.Drawing.Color]::FromArgb(0, 4, 15))

# Center 736x736 inside 1024x1024
$scaleSize = 736
$offset = [int]((1024 - $scaleSize) / 2)
$gAdaptive.DrawImage($srcImg, $offset, $offset, $scaleSize, $scaleSize)
$gAdaptive.Dispose()

Save-Png $adaptiveBmp "$baseDir\apps\DomainExpMain\assets\images\android-icon-foreground.png"
$adaptiveBmp.Dispose()

# 5. Generate matching Dark Cyber Splash Screen Background (1080x1920)
$splashBg = New-Object System.Drawing.Bitmap(1080, 1920, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gSplash = [System.Drawing.Graphics]::FromImage($splashBg)
$gSplash.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gSplash.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

# Dark space base
$gSplash.Clear([System.Drawing.Color]::FromArgb(0, 4, 15))

# Draw deep cyber ambient gradient
$brushTop = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point(0, 1920)),
    [System.Drawing.Color]::FromArgb(0, 3, 12),
    [System.Drawing.Color]::FromArgb(2, 8, 23)
)
$gSplash.FillRectangle($brushTop, 0, 0, 1080, 1920)
$brushTop.Dispose()

# Radial ambient cyan/blue glow in center upper third where the logo sits (X: 540, Y: 600)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse(140, 200, 800, 800)
$pbg = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
$pbg.CenterColor = [System.Drawing.Color]::FromArgb(60, 2, 132, 199) # Subtle deep cyan glow
$pbg.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 0, 4, 15))
$gSplash.FillPath($pbg, $path)
$pbg.Dispose()
$path.Dispose()

$gSplash.Dispose()

Save-Png $splashBg "$baseDir\apps\DomainExpMain\assets\images\splash-bg.png"
$splashBg.Dispose()

# Cleanup
$master1024.Dispose()
$srcImg.Dispose()
$msIn.Dispose()

Write-Host "`nAll icon and splash assets successfully generated and verified!"
