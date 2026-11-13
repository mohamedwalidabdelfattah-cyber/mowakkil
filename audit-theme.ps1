$projectPath = "C:\Users\hi\mowakkil\web"

$oldColors = @(
    "#6366F1", "#4F46E5", "#8B5CF6",
    "#D97706", "#B45309",
    "#3B82F6", "#2563EB"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Scanning Pages and Styles..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$htmlPages = @(
    "$projectPath\index.html",
    "$projectPath\pricing.html",
    "$projectPath\signup.html",
    "$projectPath\pay.html",
    "$projectPath\client\index.html"
)

Write-Host "--- HTML Pages ---" -ForegroundColor Yellow
foreach ($page in $htmlPages) {
    if (Test-Path $page) {
        $name = Split-Path $page -Leaf
        $content = Get-Content $page -Raw
        $hasOldColor = $false
        
        foreach ($color in $oldColors) {
            if ($content -match [regex]::Escape($color)) {
                $hasOldColor = $true
                break
            }
        }
        
        $hasBrandTheme = $content -match "brand-theme.css"
        
        if ($hasOldColor) {
            Write-Host "  [WARN] $name - contains old inline colors!" -ForegroundColor Yellow
        } elseif (-not $hasBrandTheme) {
            Write-Host "  [WARN] $name - brand-theme.css not linked!" -ForegroundColor Yellow
        } else {
            Write-Host "  [OK] $name - Clean and linked." -ForegroundColor Green
        }
    } else {
        Write-Host "  [MISSING] $page" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "--- CSS Files ---" -ForegroundColor Yellow

$cssFiles = @()
$cssFiles += Get-ChildItem -Path "$projectPath\assets\*.css" -ErrorAction SilentlyContinue
$cssFiles += Get-ChildItem -Path "$projectPath\client\assets\*.css" -ErrorAction SilentlyContinue

foreach ($css in $cssFiles) {
    $name = $css.Name
    $content = Get-Content $css.FullName -Raw
    $foundColors = @()
    
    foreach ($color in $oldColors) {
        if ($content -match [regex]::Escape($color)) {
            if ($foundColors -notcontains $color.ToUpper()) {
                $foundColors += $color.ToUpper()
            }
        }
    }
    
    if ($foundColors.Count -gt 0) {
        Write-Host "  [WARN] $name - Old colors: $($foundColors -join ', ')" -ForegroundColor Yellow
    } else {
        Write-Host "  [OK] $name - Clean." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Audit Complete!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
