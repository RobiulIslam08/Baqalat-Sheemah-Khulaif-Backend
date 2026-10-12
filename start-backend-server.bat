@echo off
cd /d "%~dp0"

echo ==========================================
echo    POS Backend Server Launcher
echo ==========================================

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b 1
)

:: Run npm install if node_modules is missing
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
)

:: Build the project if dist folder is missing
if not exist "dist\server.js" (
    echo [INFO] dist/server.js not found. Building project...
    call npm run build
)

echo [SUCCESS] Starting POS Backend on Port 5100...
npm run serve
pause
