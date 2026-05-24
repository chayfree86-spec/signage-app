$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $repoRoot "tv-app"
$buildRoot = Join-Path $appRoot "build"
$outputRoot = Join-Path $appRoot "output"
$packageName = "com.chaychaupal.signagetv"
$apkName = "chay-signage-tv.apk"

$androidSdk = $env:ANDROID_HOME
if (-not $androidSdk) { $androidSdk = $env:ANDROID_SDK_ROOT }
if (-not $androidSdk) { $androidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not (Test-Path $androidSdk)) {
  throw "Android SDK not found. Install Android SDK or set ANDROID_HOME."
}

$platform = Get-ChildItem (Join-Path $androidSdk "platforms") -Directory |
  Where-Object { Test-Path (Join-Path $_.FullName "android.jar") } |
  Sort-Object Name -Descending |
  Select-Object -First 1
if (-not $platform) { throw "No Android platform with android.jar was found." }

$buildTools = Get-ChildItem (Join-Path $androidSdk "build-tools") -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1
if (-not $buildTools) { throw "No Android build-tools folder was found." }

$androidJar = Join-Path $platform.FullName "android.jar"
$aapt2 = Join-Path $buildTools.FullName "aapt2.exe"
$d8 = Join-Path $buildTools.FullName "d8.bat"
$jar = Join-Path (Split-Path (Get-Command javac).Source -Parent) "jar.exe"
$zipalign = Join-Path $buildTools.FullName "zipalign.exe"
$apksigner = Join-Path $buildTools.FullName "apksigner.bat"

foreach ($tool in @($aapt2, $d8, $zipalign, $apksigner, $jar)) {
  if (-not (Test-Path $tool)) { throw "Required Android tool not found: $tool" }
}

$javaSourceRoot = Join-Path $appRoot "src\main\java"
$resRoot = Join-Path $appRoot "src\main\res"
$manifest = Join-Path $appRoot "src\main\AndroidManifest.xml"
$compiledRes = Join-Path $buildRoot "compiled-res"
$classesDir = Join-Path $buildRoot "classes"
$dexDir = Join-Path $buildRoot "dex"
$unsignedApk = Join-Path $buildRoot "unsigned.apk"
$alignedApk = Join-Path $buildRoot "aligned.apk"
$signedApk = Join-Path $outputRoot $apkName
$keystoreDir = Join-Path $appRoot "keystore"
$keystore = Join-Path $keystoreDir "tv-signing.jks"
$storePass = "chay-signage"
$keyAlias = "chay-signage-tv"

Remove-Item -LiteralPath $buildRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $compiledRes, $classesDir, $dexDir, $outputRoot, $keystoreDir | Out-Null

& $aapt2 compile --dir $resRoot -o (Join-Path $compiledRes "resources.zip")
if ($LASTEXITCODE -ne 0) { throw "Resource compilation failed." }

& $aapt2 link `
  -o $unsignedApk `
  -I $androidJar `
  --manifest $manifest `
  --java (Join-Path $buildRoot "generated") `
  --min-sdk-version 23 `
  --target-sdk-version 36 `
  --version-code 1 `
  --version-name "1.0" `
  (Join-Path $compiledRes "resources.zip")
if ($LASTEXITCODE -ne 0) { throw "APK resource linking failed." }

$javaFiles = Get-ChildItem -Path $javaSourceRoot, (Join-Path $buildRoot "generated") -Recurse -Filter "*.java" | ForEach-Object { $_.FullName }
if (-not $javaFiles) { throw "No Java files found." }

& javac -encoding UTF-8 -source 8 -target 8 -bootclasspath $androidJar -d $classesDir @javaFiles
if ($LASTEXITCODE -ne 0) { throw "Java compilation failed." }

$classFiles = Get-ChildItem -Path $classesDir -Recurse -Filter "*.class" | ForEach-Object { $_.FullName }
& $d8 --min-api 23 --lib $androidJar --output $dexDir @classFiles
if ($LASTEXITCODE -ne 0) { throw "DEX generation failed." }

Compress-Archive -Path (Join-Path $dexDir "classes.dex") -DestinationPath (Join-Path $buildRoot "classes.zip") -Force
Copy-Item -LiteralPath $unsignedApk -Destination (Join-Path $buildRoot "with-dex.apk") -Force
& tar -xf (Join-Path $buildRoot "classes.zip") -C $buildRoot
& $aapt2 link `
  -o (Join-Path $buildRoot "packaged.apk") `
  -I $androidJar `
  --manifest $manifest `
  --min-sdk-version 23 `
  --target-sdk-version 36 `
  --version-code 1 `
  --version-name "1.0" `
  (Join-Path $compiledRes "resources.zip")
if ($LASTEXITCODE -ne 0) { throw "Final APK packaging failed." }

& $jar uf (Join-Path $buildRoot "packaged.apk") -C $dexDir "classes.dex"
if ($LASTEXITCODE -ne 0) { throw "Adding DEX to APK failed." }

& $zipalign -f 4 (Join-Path $buildRoot "packaged.apk") $alignedApk
if ($LASTEXITCODE -ne 0) { throw "APK alignment failed." }

if (-not (Test-Path $keystore)) {
  & keytool -genkeypair `
    -keystore $keystore `
    -storepass $storePass `
    -keypass $storePass `
    -alias $keyAlias `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -dname "CN=Chay Signage TV,O=Chay Chaupal,C=IN"
  if ($LASTEXITCODE -ne 0) { throw "Signing key generation failed." }
}

& $apksigner sign `
  --ks $keystore `
  --ks-key-alias $keyAlias `
  --ks-pass "pass:$storePass" `
  --key-pass "pass:$storePass" `
  --out $signedApk `
  $alignedApk
if ($LASTEXITCODE -ne 0) { throw "APK signing failed." }

& $apksigner verify --verbose $signedApk
if ($LASTEXITCODE -ne 0) { throw "APK verification failed." }

Write-Host "Built TV APK: $signedApk"
