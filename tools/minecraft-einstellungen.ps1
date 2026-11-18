# Stellt Minecraft auf fluessiges, schoenes Streamen ein.
# WICHTIG: Minecraft vorher komplett schliessen, sonst ueberschreibt es die Datei beim Beenden.
param([string]$file = "$env:APPDATA\.minecraft\options.txt", [switch]$test)
if (-not $test -and (Get-Process javaw -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "Minecraft*" })) {
  Write-Output 'Minecraft laeuft noch - bitte zuerst schliessen.'
  exit 1
}
Copy-Item $file "$file.vor-meme-city.bak" -Force

$set = [ordered]@{
  'inactivityFpsLimit'     = '"minimized"' # nicht auf 30 FPS druecken, wenn niemand etwas drueckt (Stream!)
  'enableVsync'            = 'true'        # gleichmaessige Bilder, kein Zerreissen
  'maxFps'                 = '165'         # passend zum 165-Hz-Bildschirm
  'fullscreen'             = 'false'       # Fenster statt Vollbild: stockt nicht, wenn LIVE Studio vorne ist
  'fovEffectScale'         = '0.0'         # Sichtfeld wackelt nicht
  'bobView'                = 'false'       # kein Kopfwippen
  'renderDistance'         = '16'          # weiter sehen (RTX 4060 schafft das)
  'entityDistanceScaling'  = '2.0'         # Autos, Bewohner und Schilder auch in der Ferne sichtbar
  'renderClouds'           = '"true"'
  'chunkSectionFadeInTime' = '0.75'
  'pauseOnLostFocus'       = 'false'
  'showAutosaveIndicator'  = 'false'
}
$lines = Get-Content $file
foreach ($k in $set.Keys) {
  $found = @($lines | Where-Object { $_ -like "${k}:*" }).Count -gt 0
  $lines = $lines | ForEach-Object { if ($_ -like "${k}:*") { "${k}:$($set[$k])" } else { $_ } }
  if (-not $found) { $lines += "${k}:$($set[$k])" }
}
[IO.File]::WriteAllLines($file, [string[]]$lines, (New-Object System.Text.UTF8Encoding $false))
Write-Output 'Minecraft-Einstellungen gesetzt (Sicherung: options.txt.vor-meme-city.bak).'
