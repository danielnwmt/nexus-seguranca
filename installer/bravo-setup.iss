; ============================================================
;  Bravo Monitoramento - Inno Setup Installer Script
;  Compativel com Inno Setup 3.x+
; ============================================================

[Setup]
AppId={{B7A4C3E1-9F2D-4A8B-B5C6-1D3E5F7A9B2C}
AppName=Bravo Monitoramento
AppVersion=1.0.0
AppPublisher=Bravo Seguranca
AppPublisherURL=http://localhost
DefaultDirName=C:\BravoMonitoramento
DefaultGroupName=Bravo Monitoramento
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=BravoMonitoramento-Setup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin

[Files]
Source: "..\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules,\.git,dist,installer,\.lovable"

[Icons]
Name: "{group}\Bravo Monitoramento"; Filename: "http://localhost:80"
Name: "{group}\Iniciar Servidor"; Filename: "{app}\iniciar-bravo.bat"
Name: "{commondesktop}\Bravo Monitoramento"; Filename: "http://localhost:80"; Tasks: desktopicon
Name: "{commondesktop}\Iniciar Bravo"; Filename: "{app}\iniciar-bravo.bat"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Area de Trabalho"; GroupDescription: "Atalhos:"; Flags: checked

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\install-windows.ps1"""; Description: "Configurar sistema"; Flags: postinstall waituntilterminated
Filename: "http://localhost:80"; Description: "Abrir Bravo Monitoramento"; Flags: postinstall nowait shellexec skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\desinstalar-bravo.ps1"""; Flags: waituntilterminated
