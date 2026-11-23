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

param([Parameter(Mandatory = $true)][ValidateSet('groq', 'gemini', 'tavily', 'openrouter')][string]$Provider)

$ErrorActionPreference = 'Stop'
$spec = @{
  groq   = @{ name = 'GROQ_API_KEY';   site = 'https://console.groq.com/keys' }
  gemini = @{ name = 'GEMINI_API_KEY'; site = 'https://aistudio.google.com/apikey' }
  tavily = @{ name = 'TAVILY_API_KEY'; site = 'https://app.tavily.com' }
  openrouter = @{ name = 'OPENROUTER_API_KEY'; site = 'https://openrouter.ai/settings/keys' }
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

# كل مزود مفاتيحه ليها بداية معروفة → لو اتنسخ كلام زيادة مع المفتاح، بنطلّع المفتاح لوحده
$pattern = @{
  groq       = 'gsk_[A-Za-z0-9]{20,}'
  gemini     = 'AIza[0-9A-Za-z_\-]{30,}'
  tavily     = 'tvly-[A-Za-z0-9_\-]{16,}'
  openrouter = 'sk-or-v1-[A-Za-z0-9]{32,}'
}[$Provider]
$m = [regex]::Match($value, $pattern)
if ($m.Success -and $m.Value -ne $value) {
  Write-Host '   لقيت المفتاح وسط كلام زيادة في الحافظة — هستخدم المفتاح بس.'
  $value = $m.Value
}

if ($value.Length -lt 20) { Fail "الحافظة مفيهاش مفتاح (طول اللي فيها $($value.Length) حرف)." }
if ($value -match '\s') {
  if ($value -match 'set-ai-key|powershell|cd ') { Fail 'اللي في الحافظة هو الأمر نفسه مش المفتاح. انسخ المفتاح آخر حاجة قبل ما تدوس Enter.' }
  Fail 'اللي في الحافظة فيه مسافات ومش لاقي فيه مفتاح.'
}

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
      # بنتأكد من المفتاح بقايمة النماذج (مش بنموذج معيّن — أسماء النماذج بتتغير)
      $r = Invoke-RestMethod -Uri 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200' `
        -Headers @{ 'x-goog-api-key' = $value } -TimeoutSec 30
      $flash = @($r.models | Where-Object { $_.name -match 'flash' -and $_.supportedGenerationMethods -contains 'generateContent' })
      Write-Host "   Gemini شغال — $(@($r.models).Count) نموذج متاح ($($flash.Count) منهم Flash). النظام هيختار الأنسب لوحده."
    }
    'tavily' {
      $body = @{ query = 'Egyptian civil code'; max_results = 1; search_depth = 'basic' } | ConvertTo-Json
      $r = Invoke-RestMethod -Method Post -Uri 'https://api.tavily.com/search' `
        -Headers @{ Authorization = "Bearer $value" } -ContentType 'application/json' -Body $body -TimeoutSec 30
      Write-Host "   Tavily شغال — $(@($r.results).Count) نتيجة"
    }
    'openrouter' {
      $r = Invoke-RestMethod -Uri 'https://openrouter.ai/api/v1/key' -Headers @{ Authorization = "Bearer $value" } -TimeoutSec 30
      Write-Host '   OpenRouter شغال — النظام هيستخدم النماذج المجانية (:free) بس'
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
