@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   Cat Cafe Multi-Agent System Launcher
echo ========================================
echo.

:: Get script directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: Check common Node.js locations
set "NODE_PATH="
if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_PATH=C:\Program Files\nodejs"
)
if exist "C:\nodejs\node.exe" (
    set "NODE_PATH=C:\nodejs"
)

if "%NODE_PATH%"=="" (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Recommended version: LTS ^(20.x or higher^)
    echo.
    pause
    exit /b 1
)

:: Add Node.js to PATH
set "PATH=%NODE_PATH%;%PATH%"

:: Show Node.js version
for /f "tokens=*" %%i in ('"%NODE_PATH%\node.exe" --version') do set NODE_VERSION=%%i
echo [OK] Node.js version: %NODE_VERSION%

:: Check if backend dependencies are installed
if not exist "node_modules" (
    echo.
    echo [INFO] Installing backend dependencies...
    call "%NODE_PATH%\npm.cmd" install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install backend dependencies!
        pause
        exit /b 1
    )
)

:: Check if frontend dependencies are installed
if not exist "web\node_modules" (
    echo.
    echo [INFO] Installing frontend dependencies...
    cd web
    call "%NODE_PATH%\npm.cmd" install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install frontend dependencies!
        pause
        exit /b 1
    )
    cd ..
)

:: Build backend if dist folder doesn't exist
if not exist "dist" (
    echo.
    echo [INFO] Building backend...
    call "%NODE_PATH%\npm.cmd" run build
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to build backend!
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo   Starting services...
echo ========================================
echo.
echo Backend API: http://127.0.0.1:3000
echo Frontend UI: http://127.0.0.1:5173
echo.
echo Press Ctrl+C to stop all services
echo ========================================
echo.

:: Start backend in a new window
start "Cat Cafe Backend" cmd /k "set PATH=%NODE_PATH%;%%PATH%% && cd /d "%SCRIPT_DIR%" && "%NODE_PATH%\node.exe" dist/server.js"

:: Wait a moment for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend in a new window
start "Cat Cafe Frontend" cmd /k "set PATH=%NODE_PATH%;%%PATH%% && cd /d "%SCRIPT_DIR%web" && "%NODE_PATH%\npx.cmd" vite --host 127.0.0.1 --port 5173"

:: Wait a moment then open browser
timeout /t 4 /nobreak >nul
start http://127.0.0.1:5173

echo.
echo [OK] Services started in separate windows.
echo [OK] Browser opened to http://127.0.0.1:5173
echo.
echo Close this window or press any key to exit...
pause >nul
