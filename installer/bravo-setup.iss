; ============================================================
;  Bravo Monitoramento — Inno Setup Installer Script
;  Compile com Inno Setup: https://jrsoftware.org/isinfo.php
; ============================================================

#define MyAppName "Bravo Monitoramento"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Bravo Seguranca"
#define MyAppURL "http://localhost"
#define MyAppExeName "iniciar-bravo.bat"

[Setup]
AppId={{B7A4C3E1-9F2D-4A8B-B5C6-1D3E5F7A9B2C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName=C:\BravoMonitoramento
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=BravoMonitoramento-Setup
SetupIconFile=..\public\favicon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
LicenseFile=
InfoBeforeFile=pre-install-info.txt

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
; Copia todos os arquivos do projeto (exceto pastas desnecessarias)
Source: "..\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules,\.git,dist,installer,\.lovable"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "http://localhost:80"
Name: "{group}\Iniciar Servidor"; Filename: "{app}\iniciar-bravo.bat"; IconFilename: "{app}\public\favicon.ico"
Name: "{commondesktop}\{#MyAppName}"; Filename: "http://localhost:80"; Tasks: desktopicon
Name: "{commondesktop}\Iniciar Bravo"; Filename: "{app}\iniciar-bravo.bat"; IconFilename: "{app}\public\favicon.ico"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Area de Trabalho"; GroupDescription: "Atalhos:"; Flags: checked

[Run]
; Pos-instalacao: instalar dependencias e fazer build
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\install-windows.ps1"""; Description: "Configurar sistema (instalar dependencias e banco de dados)"; Flags: runascurrentuser waituntilterminated postinstall
Filename: "http://localhost:80"; Description: "Abrir Bravo Monitoramento"; Flags: postinstall nowait shellexec skipifsilent

[UninstallRun]
; Parar servico ao desinstalar
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\desinstalar-bravo.ps1"""; Flags: runascurrentuser waituntilterminated

[Code]
// Verificar se Node.js esta instalado
function NodeJSInstalled(): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd.exe', '/c node -v', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

// Verificar se Docker esta instalado
function DockerInstalled(): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd.exe', '/c docker --version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  
  if not NodeJSInstalled() then
  begin
    if MsgBox('Node.js nao foi detectado. O instalador tentara instala-lo automaticamente.' + #13#10 + 
              'Caso falhe, baixe em: https://nodejs.org' + #13#10#13#10 + 
              'Deseja continuar?', mbConfirmation, MB_YESNO) = IDNO then
    begin
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // Informar usuario
    MsgBox('Arquivos copiados com sucesso!' + #13#10#13#10 + 
           'Clique em "Configurar sistema" na proxima tela para:' + #13#10 +
           '  - Instalar Node.js (se necessario)' + #13#10 +
           '  - Configurar banco de dados' + #13#10 +
           '  - Fazer build do sistema' + #13#10 +
           '  - Criar servico Windows', 
           mbInformation, MB_OK);
  end;
end;
