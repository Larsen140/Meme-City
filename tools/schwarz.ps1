# Schwarzer Bildschirm, ohne den Bildschirm auszuschalten (Ausschalten laesst das Overlay im LIVE ruckeln).
# - Bildschirm bleibt technisch an -> Minecraft, LIVE Studio und Overlay laufen normal weiter
# - das schwarze Fenster ist fuer Aufnahmen unsichtbar (kommt nie in den Stream)
# - nimmt Minecraft nicht den Fokus weg
# - Tastatur ist gesperrt, solange es schwarz ist (versehentliche Tasten stoeren den Stream nicht)
# - beenden: Mausklick (Notfall: Strg+Alt+Entf funktioniert immer)
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Windows.Forms; using System.Runtime.InteropServices; using System.Diagnostics;
public class Schwarz : Form {
  [DllImport("user32.dll")] static extern bool SetWindowDisplayAffinity(IntPtr h, uint a);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int k);
  delegate IntPtr HookProc(int code, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, HookProc fn, IntPtr mod, uint thread);
  [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr h);
  [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string name);
  static HookProc keep; static IntPtr hook;
  public Schwarz(Rectangle r) {
    FormBorderStyle = FormBorderStyle.None; BackColor = Color.Black; TopMost = true; ShowInTaskbar = false;
    StartPosition = FormStartPosition.Manual; Bounds = r; Cursor.Hide();
    MouseDown += (s, e) => Ende();
  }
  protected override bool ShowWithoutActivation { get { return true; } }
  protected override CreateParams CreateParams { get { var p = base.CreateParams; p.ExStyle |= 0x08000000 | 0x80; return p; } } // NOACTIVATE, TOOLWINDOW
  protected override void OnHandleCreated(EventArgs e) { base.OnHandleCreated(e); SetWindowDisplayAffinity(Handle, 0x11); } // aus Aufnahmen ausschliessen
  static void Ende() { if (hook != IntPtr.Zero) UnhookWindowsHookEx(hook); hook = IntPtr.Zero; Cursor.Show(); Application.Exit(); }
  public static void Run() {
    var ctx = new ApplicationContext();
    // Tastatur sperren: alle Tasten werden verschluckt
    keep = (code, w, l) => (IntPtr)1;
    hook = SetWindowsHookEx(13, keep, GetModuleHandle(Process.GetCurrentProcess().MainModule.ModuleName), 0);
    // Fenster bekommt keinen Fokus, daher Mausklick direkt abfragen
    var t = new Timer { Interval = 80 }; t.Tick += (s, e) => { if ((GetAsyncKeyState(0x01) & 0x8000) != 0 || (GetAsyncKeyState(0x02) & 0x8000) != 0) Ende(); }; t.Start();
    foreach (var s in Screen.AllScreens) new Schwarz(s.Bounds).Show();
    Application.Run(ctx);
    if (hook != IntPtr.Zero) UnhookWindowsHookEx(hook);
  }
}
'@
[Schwarz]::Run()
