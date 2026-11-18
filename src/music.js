// Hintergrundmusik in Dauerschleife ueber die PC-Lautsprecher.
// Wird leiser, solange der Buergermeister spricht. Die Lautstaerke wird ueber eine
// kleine Datei an den Player weitergegeben (so blockiert nichts).
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PLAYER_SCRIPT = `
Add-Type -AssemblyName PresentationCore
$p = New-Object System.Windows.Media.MediaPlayer
$p.Open([Uri]$env:MC_MUSIC)
$t = 0; while (-not $p.NaturalDuration.HasTimeSpan -and $t -lt 200) { Start-Sleep -Milliseconds 50; $t++ }
$len = $p.NaturalDuration.TimeSpan.TotalMilliseconds
$p.Volume = 0
$p.Play()
$cur = 0.0; $n = 0; $speed = 1.0
while ($true) {
  # endet automatisch, wenn das Spielprogramm beendet wurde
  if (($n++ % 12) -eq 0 -and -not (Get-Process -Id ([int]$env:MC_PARENT) -ErrorAction SilentlyContinue)) { $p.Close(); break }
  $want = 0.2; $sp = 1.0
  try {
    $parts = (Get-Content $env:MC_VOLFILE -Raw).Trim().Split(';')
    $want = [double]::Parse($parts[0], [Globalization.CultureInfo]::InvariantCulture)
    if ($parts.Length -gt 1) { $sp = [double]::Parse($parts[1], [Globalization.CultureInfo]::InvariantCulture) }
  } catch {}
  if ([math]::Abs($sp - $speed) -gt 0.001) { $speed = $sp; $p.SpeedRatio = $speed }
  $cur = $cur + ($want - $cur) * 0.25   # weich ein-/ausblenden
  $p.Volume = $cur
  if ($len -gt 0 -and $p.Position.TotalMilliseconds -ge $len - 120) { $p.Position = [TimeSpan]::Zero; $p.Play() }
  Start-Sleep -Milliseconds 80
}
`;

export class Music {
  constructor({ file, volume = 0.2, duckVolume = 0.06, enabled = true, dataDir }, log = console.log) {
    this.volume = volume;
    this.duckVolume = duckVolume;
    this.volFile = path.join(dataDir, 'musik-lautstaerke.txt');
    if (!enabled) return;
    if (!fs.existsSync(file)) { log('[Musik] Datei fehlt – erst "node tools/musik-erzeugen.mjs" ausführen'); return; }
    fs.mkdirSync(dataDir, { recursive: true });
    this.set(volume);
    const encoded = Buffer.from(PLAYER_SCRIPT, 'utf16le').toString('base64');
    this.proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encoded], {
      env: { ...process.env, MC_MUSIC: path.resolve(file), MC_VOLFILE: this.volFile, MC_PARENT: String(process.pid) }, stdio: 'ignore',
    });
    process.on('exit', () => { try { this.proc.kill(); } catch {} });
    log('[Musik] Hintergrundmusik läuft');
  }

  set(v) { try { fs.writeFileSync(this.volFile, `${v};${this.hyped ? 1.1 : 1}`); } catch {} }
  duck(on) { this.ducked = on; this.set(on ? this.duckVolume : this.hyped ? Math.min(1, this.volume * 1.7) : this.volume); }
  /** Duell / Bau-Sprint: Musik lauter und etwas schneller */
  hype(on) { this.hyped = on; this.duck(!!this.ducked); }
}
