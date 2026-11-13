# convert-to-docx.ps1 - Convert .doc to .docx
# All paths are built dynamically from the root folder

$root = "D:\" + [char]0x0645 + [char]0x062C + [char]0x0644 + [char]0x062F + " " + [char]0x062C + [char]0x062F + [char]0x064A + [char]0x062F + "\" + [char]0x0627 + [char]0x0644 + [char]0x0641 + [char]0x0644 + [char]0x0627 + [char]0x0634 + [char]0x0629 + " " + [char]0x0627 + [char]0x0644 + [char]0x0642 + [char]0x0627 + [char]0x0646 + [char]0x0648 + [char]0x0646 + [char]0x064A + [char]0x0629 + " " + [char]0x0644 + [char]0x0644 + [char]0x0633 + [char]0x0627 + [char]0x062F + [char]0x0629 + " " + [char]0x0627 + [char]0x0644 + [char]0x0645 + [char]0x062D + [char]0x0627 + [char]0x0645 + [char]0x064A + [char]0x0646 + "\" + [char]0x0627 + [char]0x0644 + [char]0x0642 + [char]0x0648 + [char]0x0627 + [char]0x0646 + [char]0x064A + [char]0x0646

$out = "C:\Users\hi\mowakkil\laws-docx"
New-Item -ItemType Directory -Force -Path $out | Out-Null

Write-Host "Root: $root" -ForegroundColor Cyan
Write-Host "Out:  $out" -ForegroundColor Cyan

if (-not (Test-Path $root)) {
    Write-Host "ERROR: Root folder not found: $root" -ForegroundColor Red
    exit 1
}

# Get all .doc and .docx files, but ONLY those in the "codes" subfolders
# (to avoid the huge book PDFs and duplicates)
Write-Host "`nSearching for core law files..." -ForegroundColor Cyan

$allFiles = Get-ChildItem -Path $root -Recurse -File -Include *.doc,*.docx -ErrorAction SilentlyContinue

# Filter: only files smaller than 5MB (real law codes are small, books are huge)
$candidates = $allFiles | Where-Object { $_.Length -lt 5MB }

Write-Host "Found $($candidates.Count) candidate files (under 5MB)" -ForegroundColor Green

# Show them
$candidates | ForEach-Object {
    Write-Host "  - $($_.Name) ($([math]::Round($_.Length/1KB)) KB)" -ForegroundColor Gray
}

# Open Word
Write-Host "`nOpening Word..." -ForegroundColor Cyan
try {
    $word = New-Object -ComObject Word.Application
} catch {
    Write-Host "ERROR: Cannot open Word. Is it installed?" -ForegroundColor Red
    exit 1
}

$word.Visible = $false
$word.DisplayAlerts = 0

$success = 0
$failed = 0
$skipped = 0

foreach ($file in $candidates) {
    # Skip if already exists in output
    $outName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name) + ".docx"
    $outPath = Join-Path $out $outName

    if (Test-Path $outPath) {
        Write-Host "  SKIP (already exists): $outName" -ForegroundColor Yellow
        $skipped++
        continue
    }

    try {
        Write-Host "  Converting: $($file.Name)..." -NoNewline
        if ($file.Extension -eq ".docx") {
            # Already docx - just copy
            Copy-Item $file.FullName $outPath -Force
            Write-Host " COPIED" -ForegroundColor Green
        } else {
            $doc = $word.Documents.Open($file.FullName, [ref]$false, [ref]$true)
            $doc.SaveAs([ref]$outPath, [ref]16)
            $doc.Close([ref]$false)
            Write-Host " OK" -ForegroundColor Green
        }
        $success++
    } catch {
        Write-Host " FAIL ($($_.Exception.Message))" -ForegroundColor Red
        $failed++
    }
}

$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null

Write-Host "`nDONE!" -ForegroundColor Cyan
Write-Host "  Success: $success" -ForegroundColor Green
Write-Host "  Failed:  $failed" -ForegroundColor Red
Write-Host "  Skipped: $skipped" -ForegroundColor Yellow
Write-Host "  Output:  $out" -ForegroundColor Cyan