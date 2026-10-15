Add-Type -AssemblyName System.Drawing

$filesToConvert = @(
    "apps\DomainExpMain\assets\images\app-icons\aitourism.png",
    "apps\DomainExpMain\assets\images\app-icons\com_aitourism.png",
    "apps\DomainExpMain\assets\images\app-icons\com_livesale_fitness.png",
    "apps\DomainExpMain\assets\images\app-icons\com_lovenzea_online.png",
    "apps\DomainExpMain\assets\images\app-icons\com_worknai_namasteyyy.png",
    "apps\DomainExpMain\assets\images\app-icons\gymfitness.png",
    "apps\DomainExpMain\assets\images\app-icons\lovenzea.png",
    "apps\DomainExpMain\assets\images\app-icons\namasteyoga.png"
)

foreach ($relPath in $filesToConvert) {
    $fullPath = Resolve-Path $relPath
    Write-Host "Converting $relPath to real PNG..."
    
    # Read image into memory so file is not locked
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $msIn = New-Object System.IO.MemoryStream(,$bytes)
    $img = [System.Drawing.Image]::FromStream($msIn)
    
    # Save as true PNG
    $msOut = New-Object System.IO.MemoryStream
    $img.Save($msOut, [System.Drawing.Imaging.ImageFormat]::Png)
    $img.Dispose()
    $msIn.Dispose()
    
    [System.IO.File]::WriteAllBytes($fullPath, $msOut.ToArray())
    $msOut.Dispose()
    
    # Verify header
    $newBytes = [System.IO.File]::ReadAllBytes($fullPath)
    if ($newBytes[0] -eq 0x89 -and $newBytes[1] -eq 0x50 -and $newBytes[2] -eq 0x4E -and $newBytes[3] -eq 0x47) {
        Write-Host "  -> Verified: TRUE PNG (Header: 89 50 4E 47, Size: $($newBytes.Length) bytes)"
    } else {
        Write-Host "  -> ERROR: Failed to convert to PNG!"
    }
}

Write-Host "All conversions completed!"
