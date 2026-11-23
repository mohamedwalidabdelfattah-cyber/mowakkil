# scripts/set-ai-key.ps1
# بيحفظ مفتاح Groq / Gemini / Tavily في Cloudflare من الحافظة (Clipboard) بأمان:
#  1) بياخد المفتاح من الحافظة ويشيل المسافات والسطر الجديد
#  2) بيجربه فعلياً على الخدمة نفسها — لو اشتغل بس بيحفظه
#  3) بيحفظه بـ wrangler مباشرة (مش npx — npx مش بيوصّل البيانات على ويندوز)
#
# الاستخدام: انسخ المفتاح، وبعدين من فولدر المشروع:
#   powershell -ExecutionPolicy Bypass -File scripts\set-ai-key.ps1 groq
#   powershell -ExecutionPolicy Bypass -File scripts\set-ai-key.ps1 gemini
#   powershell -ExecutionPolicy Bypass -File scripts\set-ai-key.ps1 tavily

param([Parameter(Mandatory = $true)][ValidateSet('groq', 'gemini', 'tavily')][string]$Provider)

$ErrorActionPreference = 'Stop'
$spec = @{
  groq   = @{ name = 'GROQ_API_KEY';   site = 'https://console.groq.com/keys' }
  gemini = @{ name = 'GEMINI_API_KEY'; site = 'https://aistudio.google.com/apikey' }
  tavily = @{ name = 'TAVILY_API_KEY'; site = 'https://app.tavily.com' }
}[$Provider]

function Fail($msg) {
  Write-Host ''
  Write-Host "X  $msg" -ForegroundColor Red
  Write-Host "   افتح $($spec.site) وانسخ المفتاح بزرار Copy وجرب تاني."
  exit 1
}

$value = Get-Clipboard -Raw
if ($null -eq $value) { $value = '' }
$value = $value.Trim()
if ($value.Length -lt 20) { Fail "الحافظة مفيهاش مفتاح (طول اللي فيها $($value.Length) حرف)." }
if ($value -match '\s') { Fail 'اللي في الحافظة فيه مسافات — غالباً اتنسخ كلام مع المفتاح.' }

# ---- تجربة المفتاح فعلياً ----
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Write-Host "... بجرب مفتاح $Provider ($($value.Length) حرف)"
try {
  switch ($Provider) {
    'groq' {
      $r = Invoke-RestMethod -Uri 'https://api.groq.com/openai/v1/models' -Headers @{ Authorization = "Bearer $value" } -TimeoutSec 30
      Write-Host "   Groq شغال — $(@($r.data).Count) موديل متاح"
    }
    'gemini' {
      # بنجرب بنفس الطريقة اللي التطبيق بيستخدمها (OpenAI-compatible + Bearer)
      $body = @{ model = 'gemini-2.5-flash'; messages = @(@{ role = 'user'; content = 'say ok' }); max_tokens = 300 } | ConvertTo-Json -Depth 5
      $null = Invoke-RestMethod -Method Post -Uri 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' `
        -Headers @{ Authorization = "Bearer $value" } -ContentType 'application/json' -Body $body -TimeoutSec 60
      Write-Host '   Gemini شغال'
    }
    'tavily' {
      $body = @{ query = 'Egyptian civil code'; max_results = 1; search_depth = 'basic' } | ConvertTo-Json
      $r = Invoke-RestMethod -Method Post -Uri 'https://api.tavily.com/search' `
        -Headers @{ Authorization = "Bearer $value" } -ContentType 'application/json' -Body $body -TimeoutSec 30
      Write-Host "   Tavily شغال — $(@($r.results).Count) نتيجة"
    }
  }
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  $detail = ''
  try { $detail = (New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } catch {}
  if ($detail.Length -gt 300) { $detail = $detail.Substring(0, 300) }
  Fail "المفتاح ما اشتغلش مع $Provider (HTTP $code). $detail"
}

# ---- الحفظ في Cloudflare ----
$wrangler = Join-Path $env:APPDATA 'npm\wrangler.cmd'
if (-not (Test-Path $wrangler)) { Fail 'wrangler مش متسطب globally — شغّل: npm install -g wrangler' }

Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  $value | & $wrangler secret put $spec.name
  if ($LASTEXITCODE) { Fail 'الحفظ في Cloudflare فشل.' }
  $masked = $value.Substring(0, 6) + '...(' + $value.Length + ' حرف)'
  Write-Host ''
  Write-Host "OK  المفتاح اشتغل واتحفظ: $($spec.name) = $masked" -ForegroundColor Green
} finally {
  Pop-Location
  Set-Clipboard -Value ' '   # نفضي الحافظة عشان المفتاح ميفضلش فيها
}
