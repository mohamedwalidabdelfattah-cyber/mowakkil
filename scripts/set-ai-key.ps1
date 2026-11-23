# scripts/set-ai-key.ps1
# بيحفظ مفتاح Groq / Gemini / Tavily في Cloudflare من الحافظة (Clipboard) بأمان:
#  - بيتأكد إن اللي في الحافظة مفتاح حقيقي من النوع الصح قبل ما يحفظه
#  - بيشيل المسافات والسطر الجديد
#  - بيستخدم wrangler مباشرة (مش npx — npx مش بيوصّل البيانات على ويندوز)
#
# الاستخدام: انسخ المفتاح، وبعدين من فولدر المشروع:
#   powershell -ExecutionPolicy Bypass -File scripts\set-ai-key.ps1 groq
#   powershell -ExecutionPolicy Bypass -File scripts\set-ai-key.ps1 gemini
#   powershell -ExecutionPolicy Bypass -File scripts\set-ai-key.ps1 tavily

param([Parameter(Mandatory = $true)][ValidateSet('groq', 'gemini', 'tavily')][string]$Provider)

$spec = @{
  groq   = @{ name = 'GROQ_API_KEY';   prefix = 'gsk_';  site = 'https://console.groq.com/keys' }
  gemini = @{ name = 'GEMINI_API_KEY'; prefix = 'AIza';  site = 'https://aistudio.google.com/apikey' }
  tavily = @{ name = 'TAVILY_API_KEY'; prefix = 'tvly-'; site = 'https://app.tavily.com' }
}[$Provider]

$value = (Get-Clipboard -Raw)
if ($null -eq $value) { $value = '' }
$value = $value.Trim()

if ($value.Length -lt 20 -or -not $value.StartsWith($spec.prefix)) {
  Write-Host ''
  Write-Host "X  الحافظة مفيهاش مفتاح $Provider صحيح." -ForegroundColor Red
  Write-Host "   المفروض يبدأ بـ '$($spec.prefix)' وطوله أكتر من 20 حرف." -ForegroundColor Red
  Write-Host "   اللي في الحافظة دلوقتي طوله $($value.Length) حرف." -ForegroundColor Red
  Write-Host "   افتح $($spec.site) وانسخ المفتاح بزرار Copy وجرب تاني."
  exit 1
}

$wrangler = Join-Path $env:APPDATA 'npm\wrangler.cmd'
if (-not (Test-Path $wrangler)) { throw 'wrangler مش متسطب globally — شغّل: npm install -g wrangler' }

Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  $value | & $wrangler secret put $spec.name
  if ($LASTEXITCODE) { throw 'فشل الحفظ' }
  $masked = $value.Substring(0, [Math]::Min(6, $value.Length)) + '...' + '(' + $value.Length + ' حرف)'
  Write-Host ''
  Write-Host "OK  اتحفظ $($spec.name) = $masked" -ForegroundColor Green
  Write-Host '    ادخل لوحة السوبر أدمن ودوس "فحص النماذج" للتأكد.'
} finally {
  Pop-Location
  Set-Clipboard -Value ' '   # نفضي الحافظة عشان المفتاح ميفضلش فيها
}
