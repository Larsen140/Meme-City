// Stimme des Buergermeisters.
// Erzeugt Sprache mit einer natuerlichen Microsoft-Neural-Stimme (kostenlos, braucht Internet)
// und spielt sie ueber die PC-Lautsprecher ab. TikTok LIVE Studio nimmt den PC-Ton mit auf.
// Faellt die Online-Stimme aus, wird die eingebaute Windows-Stimme benutzt.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const PLAYER_SCRIPT = `
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName System.Speech
$sapi = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $sapi.SelectVoice('Microsoft Hedda Desktop') } catch {}
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  if ($line.StartsWith('PLAY ')) {
    $p = New-Object System.Windows.Media.MediaPlayer
    $p.Volume = [double]$env:MC_VOLUME
    $p.Open([Uri]$line.Substring(5))
    $t = 0
    while (-not $p.NaturalDuration.HasTimeSpan -and $t -lt 100) { Start-Sleep -Milliseconds 30; $t++ }
    $p.Play()
    [Console]::Out.WriteLine('START'); [Console]::Out.Flush()
    $ms = 3000
    if ($p.NaturalDuration.HasTimeSpan) { $ms = [int]$p.NaturalDuration.TimeSpan.TotalMilliseconds }
    Start-Sleep -Milliseconds ($ms + 150)
    $p.Close()
  } elseif ($line.StartsWith('SAY ')) {
    [Console]::Out.WriteLine('START'); [Console]::Out.Flush()
    $sapi.Speak($line.Substring(4))
  }
  [Console]::Out.WriteLine('DONE'); [Console]::Out.Flush()
}
`;

export class Speech {
  constructor({ voice = 'de-DE-ConradNeural', rate = '+0%', pitch = '+0Hz', volume = 1, enabled = true, dir } = {}, log = console.log) {
    this.log = log;
    this.enabled = enabled;
    this.voice = voice;
    this.prosody = { rate, pitch };
    this.dir = dir;
    this.queue = [];
    this.speaking = false;
    this.onStart = () => {};
    this.onEnd = () => {};
    this.waiters = { START: null, DONE: null };
    this.counter = 0;
    if (!enabled) return;
    fs.mkdirSync(dir, { recursive: true });
    const encoded = Buffer.from(PLAYER_SCRIPT, 'utf16le').toString('base64');
    this.proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', encoded], {
      env: { ...process.env, MC_VOLUME: String(volume) }, stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.proc.stdout.on('data', (d) => {
      for (const key of ['START', 'DONE']) {
        if (String(d).includes(key) && this.waiters[key]) { const r = this.waiters[key]; this.waiters[key] = null; r(); }
      }
    });
    this.proc.on('exit', () => { this.enabled = false; this.log('[Stimme] Wiedergabe beendet'); });
  }

  async tts() {
    if (!this.client) {
      this.client = new MsEdgeTTS();
      await this.client.setMetadata(this.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    }
    return this.client;
  }

  /** Text in eine MP3 umwandeln. Gibt den Dateipfad zurueck oder null. */
  async render(text) {
    const out = path.join(this.dir, String(this.counter++ % 20));
    fs.mkdirSync(out, { recursive: true });
    try {
      const client = await this.tts();
      const res = await Promise.race([
        client.toFile(out, text.replace(/[<>&]/g, ' '), this.prosody),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung')), 8000)),
      ]);
      return path.resolve(res.audioFilePath);
    } catch (e) {
      this.log('[Stimme] Online-Stimme fehlgeschlagen, nehme Windows-Stimme: ' + e.message);
      try { this.client?.close(); } catch {}
      this.client = null;
      return null;
    }
  }

  say(text, prio = false) {
    if (!text) return;
    if (!prio && this.queue.length >= 3) return; // nicht zu viel Gerede stapeln
    if (this.queue.length >= 6) this.queue.shift(); // auch Wichtiges nicht endlos stapeln
    this.queue.push(text);
    this.next();
  }

  wait(key, ms) {
    return new Promise((resolve) => {
      this.waiters[key] = resolve;
      setTimeout(() => { if (this.waiters[key] === resolve) { this.waiters[key] = null; resolve(); } }, ms);
    });
  }

  async next() {
    if (this.speaking || !this.queue.length) return;
    this.speaking = true;
    const text = this.queue.shift();
    if (this.enabled) {
      const file = await this.render(text);
      const started = this.wait('START', 5000);
      const done = this.wait('DONE', 20000);
      this.proc.stdin.write((file ? 'PLAY ' + file : 'SAY ' + text.replace(/[\r\n]+/g, ' ')) + '\n', 'utf8');
      await started;
      this.onStart(text);
      await done;
    } else {
      this.onStart(text);
      await new Promise((r) => setTimeout(r, 400 + text.length * 55));
    }
    this.onEnd(text);
    this.speaking = false;
    setTimeout(() => this.next(), 200);
  }
}
