# android/build-apk.ps1
# يبني نسخة جديدة من تطبيق أندرويد ويحطها في web/downloads/mowakkil.apk
#
# الاستخدام (من فولدر المشروع):
#   powershell -ExecutionPolicy Bypass -File android\build-apk.ps1 -Version 1.0.1
#
# ملاحظة: محتوى التطبيق بيتحدث لوحده من الموقع. محتاج تبني نسخة جديدة بس لو غيرت
# الاسم أو الأيقونة أو الألوان أو إعدادات أندرويد.

param([Parameter(Mandatory = $true)][string]$Version)

$ErrorActionPreference = 'Stop'
$root    = Split-Path $PSScriptRoot -Parent
$android = $PSScriptRoot
$jdk     = 'C:\Program Files\Microsoft\jdk-17.0.21.102-hotspot'
$sdk     = "$env:LOCALAPPDATA\Android\Sdk"
$bt      = "$sdk\build-tools\36.1.0"

$secrets = Join-Path $android 'KEYSTORE-SECRETS.txt'
if (-not (Test-Path $secrets)) { throw 'KEYSTORE-SECRETS.txt مش موجود — رجّعه من النسخة الاحتياطية' }
$pass = ((Get-Content $secrets -Encoding utf8 | Select-String '^Password').Line -replace '^Password\s*:\s*', '').Trim()

# رقم الإصدار: versionCode بيزيد 1 كل مرة
$gradle = Join-Path $android 'app\build.gradle'
$text = [IO.File]::ReadAllText($gradle)
$code = [int]([regex]::Match($text, 'versionCode\s+(\d+)').Groups[1].Value) + 1
$text = [regex]::Replace($text, 'versionCode\s+\d+', "versionCode $code")
$text = [regex]::Replace($text, 'versionName\s+"[^"]*"', "versionName `"$Version`"")
[IO.File]::WriteAllText($gradle, $text, (New-Object Text.UTF8Encoding($false)))
Write-Host "Version $Version (code $code)"

Push-Location $android
try {
  Remove-Item Env:NoDefaultCurrentDirectoryInExePath -ErrorAction SilentlyContinue
  $env:JAVA_HOME = $jdk
  $env:ANDROID_HOME = $sdk
  cmd /c "gradlew.bat assembleRelease --quiet"
  if ($LASTEXITCODE) { throw 'Gradle build failed' }

  & "$bt\zipalign.exe" -p -f 4 'app\build\outputs\apk\release\app-release-unsigned.apk' 'app-release-unsigned-aligned.apk'
  $env:MW_KS_PASS = $pass
  & "$jdk\bin\java.exe" -jar "$bt\lib\apksigner.jar" sign --ks mowakkil-release.keystore --ks-key-alias mowakkil `
      --ks-pass env:MW_KS_PASS --key-pass env:MW_KS_PASS --out app-release-signed.apk app-release-unsigned-aligned.apk
  Remove-Item Env:MW_KS_PASS
  if ($LASTEXITCODE) { throw 'Signing failed' }

  Copy-Item app-release-signed.apk (Join-Path $root 'web\downloads\mowakkil.apk') -Force
  Write-Host 'Done: web\downloads\mowakkil.apk — انشر الموقع عشان النسخة الجديدة تتاح للتنزيل'
} finally {
  Pop-Location
}
