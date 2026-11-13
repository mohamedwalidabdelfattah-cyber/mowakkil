# ==========================================================
# Fix Yellow/Gold Backgrounds on Buttons -> Make them Navy
# ==========================================================

$projectPath = "C:\Users\hi\mowakkil\web"

$filesToFix = @(
    "$projectPath\assets\brand-theme.css",
    "$projectPath\assets\styles.clean.css",
    "$projectPath\assets\pricing.css",
    "$projectPath\assets\landing.css"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Fixing Ugly Yellow/Gold Backgrounds..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$fixedCount = 0

foreach ($file in $filesToFix) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $originalContent = $content
        
        # استبدال أي خلفية ذهبية صريحة بكحلي
        $content = $content -replace 'background:\s*var\(--brand-gold\)', 'background: var(--brand-navy)'
        $content = $content -replace 'background-color:\s*var\(--brand-gold\)', 'background-color: var(--brand-navy)'
        $content = $content -replace 'background:\s*#D4AF37', 'background: #0F172A'
        $content = $content -replace 'background-color:\s*#D4AF37', 'background-color: #0F172A'
        
        # تغيير لون النص اللي كان كحلي (لأنه هيبقى على خلفية كحلية) إلى أبيض
        $content = $content -replace 'color:\s*var\(--brand-navy\)', 'color: #FFFFFF'
        $content = $content -replace 'color:\s*#0F172A', 'color: #FFFFFF'
        
        if ($content -ne $originalContent) {
            $content | Out-File -FilePath $file -Encoding utf8 -NoNewline
            Write-Host "FIXED: $file" -ForegroundColor Green
            $fixedCount++
        } else {
            Write-Host "SKIP (Clean): $file" -ForegroundColor DarkGray
        }
    }
}

Write-Host ""
if ($fixedCount -gt 0) {
    Write-Host " Successfully fixed $fixedCount files!" -ForegroundColor Green
} else {
    Write-Host " No changes needed. Everything looks good." -ForegroundColor Yellow
}
Write-Host "==========================================" -ForegroundColor Cyan