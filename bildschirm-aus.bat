@echo off
rem Schaltet nur den Bildschirm aus. Stream, Minecraft und Meme City laufen weiter.
rem Maus bewegen oder Taste druecken schaltet ihn wieder an.
powershell -NoProfile -Command "Add-Type -Namespace MC -Name Mon -MemberDefinition '[DllImport(\"user32.dll\")] public static extern int SendMessage(int h, int m, int w, int l);'; Start-Sleep 1; [MC.Mon]::SendMessage(0xFFFF, 0x0112, 0xF170, 2) | Out-Null"
