# ==========================================================
# Ultimate Purple Fixer Script (Version 2)
# بيستبدل كل أكواد اللون البنفسجي بالذهبي/الكحلي
# ==========================================================

$projectPath = "C:\Users\hi\mowakkil\web"

# الملفات المستهدفة
$files = @(
    "$projectPath\assets\design-system.css",
    "$projectPath\assets\pricing.css",
    "$projectPath\assets\styles.clean.css",
    "$projectPath\assets\styles.css",
    "$projectPath\js\views\reports.js",
    "$projectPath\js\views\money.js",
    "$projectPath\js\views\dashboard.js",
    "$projectPath\js\views\accounting.js"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Starting Purple to Gold Replacement..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $originalContent = $content
        
        # استبدال الألوان السداسية (Hex)
        $content = $content -replace '(?i)#6366F1', '#D4AF37' # بنفسجي -> ذهبي
        $content = $content -replace '(?i)#4F46E5', '#B8860B' # بنفسجي غامق -> ذهبي غامق
        $content = $content -replace '(?i)#8B5CF6', '#0F172A' # بنفسجي فاتح -> كحلي
        
        # استبدال ألوان الـ RGB
        $content = $content -replace '(?i)rgba\(99,\s*102,\s*241', 'rgba(212, 175, 55'
        $content = $content -replace '(?i)rgba\(79,\s*70,\s*229', 'rgba(184, 134, 11'
        $content = $content -replace '(?i)rgba\(139,\s*92,\s*246', 'rgba(15, 23, 42'
        
        # استبدال أسماء الكلاسات لو موجودة
        $content = $content -replace '(?i)var\(--primary-500\)', 'var(--brand-gold)'
        
        if ($content -ne $originalContent) {
            $content | Out-File -FilePath $file -Encoding utf8 -NoNewline
            Write-Host "FIXED: $file" -ForegroundColor Green
        } else {
            Write-Host "SKIP (No purple found): $file" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "NOT FOUND: $file" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Replacement complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan