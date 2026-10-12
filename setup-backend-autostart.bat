@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"
set "PROJECT_DIR=%cd%"
set "VBS_NAME=start-backend-silent.vbs"
set "VBS_SOURCE=%PROJECT_DIR%\%VBS_NAME%"
set "SHORTCUT_NAME=POS_Backend_Autostart.lnk"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\%SHORTCUT_NAME%"

echo ==========================================
echo    POS Backend Auto-Start Setup
echo ==========================================

:: 1. Install and Build
echo [1/3] Preparing project (npm install and build)...
call npm install
call npm run build

:: 2. Create Startup Shortcut
echo [2/3] Creating Windows Startup shortcut...
if exist "%SHORTCUT_PATH%" del "%SHORTCUT_PATH%"

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%VBS_SOURCE%'; $s.WorkingDirectory = '%PROJECT_DIR%'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [SUCCESS] Shortcut created in Windows Startup folder.
) else (
    echo [ERROR] Failed to create shortcut.
    pause
    exit /b 1
)

:: 3. Launch Backend
echo [3/3] Launching backend in background...
start "" "%VBS_SOURCE%"

echo ==========================================
echo ✅ Setup Complete! 
echo The POS Backend will now start automatically when Windows starts.
echo You can close this window now.
echo ==========================================
pause
