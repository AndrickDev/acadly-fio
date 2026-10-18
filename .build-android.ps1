$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
Set-Location C:\Users\andri\acadly-fio\apps\mobile
"=== PREBUILD $(Get-Date -Format T)"
npx expo prebuild --platform android --clean --no-install 2>&1
$sdk = $env:ANDROID_HOME.Replace('\', '/')
Set-Content -Path android\local.properties -Value "sdk.dir=$sdk`ncmake.dir=$sdk/cmake/3.31.6" -Encoding ASCII
"=== GRADLE $(Get-Date -Format T)"
Set-Location android
.\gradlew.bat assembleRelease "-PreactNativeArchitectures=arm64-v8a" 2>&1
"=== FIM exit=$LASTEXITCODE $(Get-Date -Format T)"
