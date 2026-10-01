@echo off
rem Instala o escaneador do MinasLab neste PC (sem precisar de administrador).
rem Cria %LOCALAPPDATA%\MinasLab\Escaneador e registra o endereco minaslab-scan:// para o usuario atual.
setlocal
set "DEST=%LOCALAPPDATA%\MinasLab\Escaneador"
set "BASE=https://leogpereira-afk.github.io/minaslab-painel/scanner"
if not exist "%DEST%" mkdir "%DEST%"
echo Baixando o escaneador...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest -UseBasicParsing '%BASE%/MinasLab-Escanear.ps1' -OutFile '%DEST%\MinasLab-Escanear.ps1'"
if errorlevel 1 ( echo Nao foi possivel baixar. Verifique a internet e tente de novo. & pause & exit /b 1 )
if not exist "%DEST%\config.ini" ( >"%DEST%\config.ini" echo Perfil=MinasLab & >>"%DEST%\config.ini" echo Dpi=200 )
reg add "HKCU\Software\Classes\minaslab-scan" /ve /d "URL:MinasLab Escaneador" /f >nul
reg add "HKCU\Software\Classes\minaslab-scan" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\minaslab-scan\shell\open\command" /ve /d "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%DEST%\MinasLab-Escanear.ps1\" \"%%1\"" /f >nul
echo.
echo Escaneador instalado em %DEST%
echo Falta so criar no NAPS2 um perfil chamado MinasLab (veja o LEIA-ME). Pode fechar esta janela.
pause
