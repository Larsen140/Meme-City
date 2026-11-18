# Schwarzer Bildschirm, ohne den Bildschirm auszuschalten (Ausschalten laesst das Overlay im LIVE ruckeln).
# - Bildschirm bleibt technisch an -> Minecraft, LIVE Studio und Overlay laufen normal weiter
# - das schwarze Fenster ist fuer Aufnahmen unsichtbar (kommt nie in den Stream)
# - nimmt Minecraft nicht den Fokus weg
# - beenden: Mausklick, Esc, Leertaste oder Enter
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Windows.Forms; using System.Runtime.InteropServices;
public class Schwarz : Form {
  [DllImport("user32.dll")] static extern bool SetWindowDisplayAffinity(IntPtr h, uint a);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int k);
  public Schwarz(Rectangle r) {
    FormBorderStyle = FormBorderStyle.None; BackColor = Color.Black; TopMost = true; ShowInTaskbar = false;
    StartPosition = FormStartPosition.Manual; Bounds = r; Cursor.Hide();
    MouseDown += (s, e) => Application.Exit(); KeyDown += (s, e) => Application.Exit();
  }
  protected override bool ShowWithoutActivation { get { return true; } }
  protected override CreateParams CreateParams { get { var p = base.CreateParams; p.ExStyle |= 0x08000000 | 0x80; return p; } } // NOACTIVATE, TOOLWINDOW
  protected override void OnHandleCreated(EventArgs e) { base.OnHandleCreated(e); SetWindowDisplayAffinity(Handle, 0x11); } // aus Aufnahmen ausschliessen
  public static void Run() {
    var ctx = new ApplicationContext();
    // Fenster bekommt keinen Fokus, daher Tasten/Klicks direkt abfragen: Esc, Leertaste oder Mausklick beendet
    var t = new Timer { Interval = 80 }; t.Tick += (s, e) => { foreach (int k in new[] { 0x1B, 0x20, 0x0D, 0x01, 0x02 }) if ((GetAsyncKeyState(k) & 0x8000) != 0) { Cursor.Show(); Application.Exit(); } }; t.Start();
    foreach (var s in Screen.AllScreens) new Schwarz(s.Bounds).Show();
    Application.Run(ctx);
  }
}
'@
[Schwarz]::Run()
