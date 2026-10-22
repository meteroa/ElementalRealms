@echo off
title Elemental Realms - Preview
cd /d "%~dp0android"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Node.js is not found. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [Elemental Realms] Dependencies not found. Running npm install, please wait...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [Error] npm install failed. Please check your network connection.
        pause
        exit /b 1
    )
    echo.
    echo [Elemental Realms] Dependencies successfully installed!
    echo.
)

echo [Elemental Realms] Building production assets...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [Error] Build failed! Please check code errors above.
    pause
    exit /b 1
)

echo.
echo [Elemental Realms] Launching preview server...
start "" http://localhost:5174
call npm run preview
if errorlevel 1 pause
