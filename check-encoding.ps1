$projectPath = "C:\Users\hi\mowakkil\web"
$badFiles = @()

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Scanning for Encoding Issues..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$files = @()
$files += Get-ChildItem -Path "$projectPath\*.html" -ErrorAction SilentlyContinue
$files += Get-ChildItem -Path "$projectPath\*.js" -ErrorAction SilentlyContinue
$files += Get-ChildItem -Path "$projectPath\assets\*.css" -ErrorAction SilentlyContinue
$files += Get-ChildItem -Path "$projectPath\js\*.js" -ErrorAction SilentlyContinue
$files += Get-ChildItem -Path "$projectPath\js\views\*.js" -ErrorAction SilentlyContinue
$files += Get-ChildItem -Path "$projectPath\client\*.html" -ErrorAction SilentlyContinue
$files += Get-ChildItem -Path "$projectPath\client\js\*.js" -ErrorAction SilentlyContinue

foreach ($file in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    
    # Check for common corruption patterns
    $hasBadPattern = $false
    
    # Arabic text usually contains characters between \u0600 and \u06FF
    # If a file has "??" or "Ã" or weird symbols, it's likely corrupted
    if ($content -match '\?\?\?' -or $content -match 'Ã' -or $content -match 'â€') {
        $hasBadPattern = $true
    }
    
    # Check if file is mostly ASCII but contains arabic-looking gibberish
    $arabicCount = ([regex]::Matches($content, '[\u0600-\u06FF]')).Count
    $gibberishCount = ([regex]::Matches($content, '[Ãâ€š¬Å½]')).Count
    
    if ($gibberishCount -gt 5 -or ($arabicCount -eq 0 -and $gibberishCount -gt 0)) {
        $hasBadPattern = $true
    }
    
    if ($hasBadPattern) {
        $badFiles += $file.FullName
        Write-Host "  [ENCODING ISSUE] $($file.FullName)" -ForegroundColor Red
        Write-Host "    Arabic chars: $arabicCount | Gibberish chars: $gibberishCount" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
if ($badFiles.Count -eq 0) {
    Write-Host " All files are clean! No encoding issues." -ForegroundColor Green
} else {
    Write-Host " Found $($badFiles.Count) files with encoding issues." -ForegroundColor Yellow
    Write-Host " Files are listed above." -ForegroundColor Yellow
}
Write-Host "==========================================" -ForegroundColor Cyan
