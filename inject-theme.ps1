$projectPath = "C:\Users\hi\mowakkil\web"

# 1. Fix Orange Colors in CSS
$cssFiles = @(
    "$projectPath\assets\design-system.css",
    "$projectPath\assets\landing.css",
    "$projectPath\assets\styles.clean.css",
    "$projectPath\assets\styles.css"
)

Write-Host "Fixing orange colors in CSS files..." -ForegroundColor Cyan
foreach ($file in $cssFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $content = $content -replace '#D97706', '#D4AF37'
        $content = $content -replace '#d97706', '#D4AF37'
        $content = $content -replace '#B45309', '#B8860B'
        $content = $content -replace '#b45309', '#B8860B'
        $content | Out-File -FilePath $file -Encoding utf8 -NoNewline
        Write-Host "  [FIXED] $(Split-Path $file -Leaf)" -ForegroundColor Green
    }
}

# 2. Inject brand-theme.css into HTML pages
$htmlPages = @(
    "$projectPath\pricing.html",
    "$projectPath\signup.html",
    "$projectPath\pay.html",
    "$projectPath\client\index.html"
)

Write-Host "`nInjecting brand-theme.css into HTML pages..." -ForegroundColor Cyan
foreach ($page in $htmlPages) {
    if (Test-Path $page) {
        $name = Split-Path $page -Leaf
        $content = Get-Content $page -Raw
        
        if ($content -notmatch "brand-theme.css") {
            # Inject right before </head>
            $content = $content -replace '</head>', "  <link rel=`"stylesheet`" href=`"/assets/brand-theme.css`">`n</head>"
            $content | Out-File -FilePath $page -Encoding utf8 -NoNewline
            Write-Host "  [INJECTED] $name" -ForegroundColor Green
        } else {
            Write-Host "  [SKIP] $name (already linked)" -ForegroundColor DarkGray
        }
    }
}
Write-Host "`nDone!" -ForegroundColor Cyan
