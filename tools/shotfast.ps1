param([int]$n = 8, [int]$ms = 150)
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class D2 { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }'
[D2]::SetProcessDPIAware() | Out-Null
$sw = [Diagnostics.Stopwatch]::StartNew()
for ($i = 0; $i -lt $n; $i++) {
  $bmp = New-Object System.Drawing.Bitmap 640, 60
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen(964, 1238, 0, 0, $bmp.Size)   # Laufband-Bereich der LIVE-Vorschau
  $sum = 0; for ($x = 0; $x -lt 640; $x += 7) { $c = $bmp.GetPixel($x, 30); $sum += ($c.R * 3 + $c.G * 5 + $c.B * 7) * ($x + 1) }
  "{0,5} ms  {1}" -f $sw.ElapsedMilliseconds, $sum
  $g.Dispose(); $bmp.Dispose(); Start-Sleep -Milliseconds $ms
}
