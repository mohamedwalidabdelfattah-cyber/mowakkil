# ==========================================================
# Purple Color Hunter Script
# بيدور على أي أثر للون البنفسجي في المشروع
# ==========================================================

$projectPath = "C:\Users\hi\mowakkil\web"
$purplePatterns = @(
    "#6366F1", "#6366f1", "#4F46E5", "#4f46e5", "#8B5CF6", "#8b5cf6",
    "#6366f", "#4F46E", "#8B5CF",
    "indigo", "purple", "violet",
    "99, 102, 241", "79, 70, 229", "139, 92, 246"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Searching for Purple Colors..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$foundCount = 0

# الملفات اللي هنفحصها
$filesToCheck = @()
$filesToCheck += Get-ChildItem -Path "$projectPath\*.html" -ErrorAction SilentlyContinue
$filesToCheck += Get-ChildItem -Path "$projectPath\assets\*.css" -ErrorAction SilentlyContinue
$filesToCheck += Get-ChildItem -Path "$projectPath\js\*.js" -ErrorAction SilentlyContinue
$filesToCheck += Get-ChildItem -Path "$projectPath\js\views\*.js" -ErrorAction SilentlyContinue

foreach ($file in $filesToCheck) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }

    foreach ($pattern in $purplePatterns) {
        if ($content -match [regex]::Escape($pattern)) {
            $foundCount++
            Write-Host "FOUND: $($file.FullName)" -ForegroundColor Yellow
            Write-Host "   Pattern: $pattern" -ForegroundColor Red
            
            # هنطلع أرقام السطور اللي فيها اللون
            $lines = Get-Content $file.FullName
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match [regex]::Escape($pattern)) {
                    Write-Host "   Line $($i + 1): $($lines[$i].Trim().Substring(0, [Math]::Min(80, $lines[$i].Trim().Length)))" -ForegroundColor DarkGray
                }
            }
            Write-Host ""
            break # لو لقينا واحد في الملف، مش محتاجين نكمل باقي الأنماط
        }
    }
}

Write-Host "==========================================" -ForegroundColor Cyan
if ($foundCount -eq 0) {
    Write-Host " No purple colors found! All clean." -ForegroundColor Green
} else {
    Write-Host " Found purple in $foundCount files." -ForegroundColor Yellow
    Write-Host " Check the files above to remove it." -ForegroundColor Yellow
}
Write-Host "==========================================" -ForegroundColor Cyan