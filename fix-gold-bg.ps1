# ==========================================================
# Fix Ugly Gold Backgrounds -> Replace with Navy
# ==========================================================

$projectPath = "C:\Users\hi\mowakkil\web"

$files = @(
    "$projectPath\assets\design-system.css",
    "$projectPath\assets\pricing.css",
    "$projectPath\assets\styles.clean.css",
    "$projectPath\assets\styles.css",
    "$projectPath\js\views\reports.js"
)

Write-Host "Fixing ugly gold backgrounds..." -ForegroundColor Cyan

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $originalContent = $content
        
        # استبدال أي خلفية ذهبية (أو ظلال ذهبية) بكحلي أو ظل كحلي
        # في ملفات JS (الرسوم البيانية)
        if ($file -like "*.js") {
            $content = $content -replace 'rgba\(212,\s*175,\s*55', 'rgba(15, 23, 42'
            $content = $content -replace '#D4AF37', '#0F172A'
        } 
        # في ملفات CSS
        else {
            # استبدال ظلال الأزرار الذهبية اللي بتبان وحشة بظلال كحلية
            $content = $content -replace 'box-shadow:\s*0\s+4px\s+14px\s+rgba\(212,\s*175,\s*55', 'box-shadow: 0 4px 14px rgba(15, 23, 42'
            $content = $content -replace 'box-shadow:\s*0\s+8px\s+20px\s+rgba\(212,\s*175,\s*55', 'box-shadow: 0 8px 20px rgba(15, 23, 42'
            $content = $content -replace 'box-shadow:\s*0\s+12px\s+32px\s+rgba\(212,\s*175,\s*55', 'box-shadow: 0 12px 32px rgba(15, 23, 42'
            
            # استبدال الخلفيات الذهبية في الأزرار (زي الباقات) بالكحلي
            $content = $content -replace 'background:\s*#D4AF37', 'background: #0F172A'
            $content = $content -replace 'background-color:\s*#D4AF37', 'background-color: #0F172A'
            $content = $content -replace 'background:\s*linear-gradient\([^)]*#D4AF37[^)]*\)', 'background: #0F172A'
        }
        
        if ($content -ne $originalContent) {
            $content | Out-File -FilePath $file -Encoding utf8 -NoNewline
            Write-Host "FIXED: $file" -ForegroundColor Green
        } else {
            Write-Host "SKIP: $file" -ForegroundColor DarkGray
        }
    }
}

Write-Host "Done!" -ForegroundColor Cyan