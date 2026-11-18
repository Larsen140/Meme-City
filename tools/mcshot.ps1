# Bild des Minecraft-Fensters (auch wenn es verdeckt ist) fuer die Kamera-Pruefung
param([string]$Out = "$PSScriptRoot\..\data\mcshot.png")
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out R r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  public struct R { public int L, T, Rt, B; }
}
'@
[W]::SetProcessDPIAware() | Out-Null
$p = Get-Process javaw -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like 'Minecraft*' } | Select-Object -First 1
if (-not $p) { 'kein Minecraft-Fenster'; exit 1 }
$r = New-Object W+R; [W]::GetClientRect($p.MainWindowHandle, [ref]$r) | Out-Null
$bmp = New-Object System.Drawing.Bitmap ($r.Rt), ($r.B)
$g = [System.Drawing.Graphics]::FromImage($bmp); $dc = $g.GetHdc()
[W]::PrintWindow($p.MainWindowHandle, $dc, 3) | Out-Null
$g.ReleaseHdc($dc); $g.Dispose()
$s = [Math]::Min([double]1, [double]960 / $r.Rt)
$w = [int]($r.Rt * $s); $h = [int]($r.B * $s)
$small = New-Object System.Drawing.Bitmap $w, $h
$g2 = [System.Drawing.Graphics]::FromImage($small); $g2.DrawImage($bmp, 0, 0, $w, $h); $g2.Dispose()
# Hochformat-Ausschnitt (Mitte, 9:16) wie im Stream, verkleinert auf 405x720
$cw = [int]($r.B * 9 / 16); $cx = [int](($r.Rt - $cw) / 2)
$crop = New-Object System.Drawing.Bitmap 405, 720
$g3 = [System.Drawing.Graphics]::FromImage($crop)
$g3.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0, 0, 405, 720), (New-Object System.Drawing.Rectangle $cx, 0, $cw, $r.B), [System.Drawing.GraphicsUnit]::Pixel)
$g3.Dispose()
$crop.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
"$($p.MainWindowTitle) $($r.Rt)x$($r.B)"
