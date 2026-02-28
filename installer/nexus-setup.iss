; ============================================================
;  Nexus Monitoramento - Inno Setup Installer Script
;  PostgreSQL + PostgREST + Auth Server + Frontend
;  Inno Setup 6.x
; ============================================================

[Setup]
AppId={{B7A4C3E1-9F2D-4A8B-B5C6-1D3E5F7A9B2C}
AppName=Nexus Monitoramento
AppVersion=1.0.0
AppPublisher=Nexus Seguranca
AppPublisherURL=http://localhost
DefaultDirName=C:\NexusMonitoramento
DefaultGroupName=Nexus Monitoramento
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=NexusMonitoramento-Setup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
InfoBeforeFile=pre-install-info.txt

[Files]
Source: "..\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules,\.git,dist,\.lovable,postgrest,auth-server"

[Icons]
Name: "{group}\Nexus Monitoramento"; Filename: "http://localhost:80"
Name: "{group}\Iniciar Servidor"; Filename: "{app}\iniciar-nexus.bat"
Name: "{group}\Atualizar Sistema"; Filename: "{app}\atualizar-nexus.bat"
Name: "{commondesktop}\Nexus Monitoramento"; Filename: "http://localhost:80"; Tasks: desktopicon
Name: "{commondesktop}\Iniciar Nexus"; Filename: "{app}\iniciar-nexus.bat"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Area de Trabalho"; Flags: unchecked

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\install-windows.ps1"""; Description: "Instalar e configurar sistema (PostgreSQL + PostgREST)"; Flags: postinstall runascurrentuser waituntilterminated
Filename: "http://localhost:80"; Description: "Abrir Nexus Monitoramento"; Flags: postinstall nowait shellexec skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\desinstalar-nexus.ps1"""; Flags: runascurrentuser waituntilterminated
