// Haelt den PC wach (kein Standby; der Bildschirm darf ausgehen), solange das Spielprogramm laeuft.
// Aendert keine Windows-Einstellungen: wie ein Videoplayer meldet es nur "bitte wach bleiben".
// Endet automatisch mit dem Spielprogramm.
import { spawn } from 'child_process';

const SCRIPT = `
Add-Type -Namespace MC -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
# ES_CONTINUOUS | ES_SYSTEM_REQUIRED (PC bleibt wach, Bildschirm darf aus)
while ($true) {
  [MC.Power]::SetThreadExecutionState([uint32]"0x80000001") | Out-Null
  if (-not (Get-Process -Id ([int]$env:MC_PARENT) -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Seconds 30
}
`;

export function keepAwake(log = console.log) {
  const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64');
  const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
    env: { ...process.env, MC_PARENT: String(process.pid) }, stdio: 'ignore',
  });
  process.on('exit', () => { try { p.kill(); } catch {} });
  log('[PC] Standby ist ausgeschaltet, solange Meme City läuft');
}
